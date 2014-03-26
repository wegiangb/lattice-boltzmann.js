var boltzmann = boltzmann || {};
var boltzmann = (function (module) {
    module.events = (function () {
        var lattice_width = module.lattice_width;
        var lattice_height = module.lattice_height;
        var lattice = module.lattice;
        var px_per_node = module.px_per_node;
        var queue = module.queue;
        var canvas = module.boltzcanvas;
        var steps_per_frame = module.steps_per_frame;
        var particles = module.flow_particles;
        // The reset button also affects the start button and vector and particle
        // checkboxes, , so they need to be available outside of the register function
        var startbutton;
        var flowvector;
        var flowparticle;

        function mousedownListener(e) {
            var button = e.which || e.button;
            if (button !== 1) {return;} // Only capture left click
            if (!module.animation_id) {return;} // Don't capture if stopped
            var oldX = e.hasOwnProperty('offsetX') ? e.offsetX : e.layerX;
            var oldY = e.hasOwnProperty('offsetY') ? e.offsetY : e.layerY;

            var moveListener = function(e) {
                var radius = 5;
                var newX = e.hasOwnProperty('offsetX') ? e.offsetX : e.layerX;
                var newY = e.hasOwnProperty('offsetY') ? e.offsetY : e.layerY;
                var dx = (newX - oldX) / px_per_node / steps_per_frame;
                var dy = (newY - oldY) / px_per_node / steps_per_frame;
                // Ensure that push isn't too big
                if (Math.abs(dx) > 0.1) {
                    dx = 0.1 * Math.abs(dx) / dx;
                }
                if (Math.abs(dy) > 0.1) {
                    dy = 0.1 * Math.abs(dy) / dy;
                }
                // Scale from canvas coordinates to lattice coordinates
                var lattice_x = Math.floor(newX / px_per_node);
                var lattice_y = Math.floor(newY / px_per_node);
                for (var x = -radius; x <= radius; x++) {
                    for (var y = -radius; y <= radius; y++) {
                        // Push in circle around cursor. Make sure coordinates are in bounds.
                        if (lattice_x + x >= 0 && lattice_x + x < lattice_width &&
                            lattice_y + y >= 0 && lattice_y + y < lattice_height &&
                            !lattice[lattice_x + x][lattice_y + y].barrier &&
                            Math.sqrt((x * x) + (y * y)) < radius) {
                            queue.push([lattice_x + x, lattice_y + y, dx, dy]);
                        }
                    }
                }
            oldX = newX;
            oldY = newY;
            };

            var mouseupListener = function(e) {
                canvas.removeEventListener('mousemove', moveListener, false);
                canvas.removeEventListener('mouseup', mouseupListener, false);

                canvas.removeEventListener('touchmove', moveListener, false);
                document.body.removeEventListener('touchend', mouseupListener, false);
            };

            canvas.addEventListener('mousemove', moveListener, false);
            canvas.addEventListener('mouseup', mouseupListener, false);

            canvas.addEventListener('touchmove', moveListener, false);
            document.body.addEventListener('touchend', mouseupListener, false);
        }

        function place_barrier(e) {
            e.preventDefault();
            var mouse_x = e.hasOwnProperty('offsetX') ? e.offsetX : e.layerX;
            var mouse_y = e.hasOwnProperty('offsetY') ? e.offsetY : e.layerY;
            var lattice_x = Math.floor(mouse_x / px_per_node);
            var lattice_y = Math.floor(mouse_y / px_per_node);
            var draw = true; // Drawing, or erasing?
            if (lattice[lattice_x][lattice_y].barrier) {
                draw = false;
            }
            lattice[lattice_x][lattice_y].barrier = draw;

            var moveListener = function(e) {
                mouse_x = e.hasOwnProperty('offsetX') ? e.offsetX : e.layerX;
                mouse_y = e.hasOwnProperty('offsetY') ? e.offsetY : e.layerY;
                // Scale from canvas coordinates to lattice coordinates
                lattice_x = Math.floor(mouse_x / px_per_node);
                lattice_y = Math.floor(mouse_y / px_per_node);
                // Draw/erase barrier
                lattice[lattice_x][lattice_y].barrier = draw;
                module.new_barrier = true;
                if (!module.animation_id) {
                    // If stopped, we need to explicitly call draw()
                    module.drawing.draw();
                }
            };

            var mouseupListener = function(e) {
                canvas.removeEventListener('mousemove', moveListener, false);
                canvas.removeEventListener('mouseup', mouseupListener, false);

                canvas.removeEventListener('touchmove', moveListener, false);
                document.body.removeEventListener('touchend', mouseupListener, false);
            };

            canvas.addEventListener('mousemove', moveListener, false);
            canvas.addEventListener('mouseup', mouseupListener, false);

            canvas.addEventListener('touchmove', moveListener, false);
            document.body.addEventListener('touchend', mouseupListener, false);
        }

        function update_draw_mode(e) {
            module.draw_mode = this.selectedIndex;
        }

        function update_speed(e) {
            module.steps_per_frame = parseInt(this.value, 10);
        }

        function update_viscosity(e){
            module.viscosity = parseInt(this.value, 10) / 100;
            module.omega = 1 / (3 * module.viscosity + 0.5);
        }

        function init_flow_particles() {
            particles.length = 0;
            for (var x = 0; x < 20; x++) {
                for (var y = 0; y < 8; y++) {
                    if (!lattice[x*10][y*10].barrier) {
                        particles.push({'x':x*10, 'y':y*10});
                    }
                }
            }
        }

        function toggle_vectors(e) {
            if (this.checked) {
                module.flow_vectors = true;
            } else {
                module.flow_vectors = false;
                module.vectorctx.clearRect(0, 0, canvas.width, canvas.height); // Clear vector canvas
            }
        }
        
        function toggle_particles(e) {
            if (this.checked) {
                init_flow_particles();
            } else {
                particles.length = 0;
                module.particlectx.clearRect(0, 0, canvas.width, canvas.height); // Clear
            }
        }

        function stop(bttn) {
            // Stop animation
            window.cancelAnimationFrame(module.animation_id);
            module.animation_id = null;
            bttn.innerHTML = "Start";
        }

        function start(bttn) {
            // Start animation
            // Flush any mouse events that occured while the program was stopped
            module.queue.length = 0;
            module.main.updater();
            bttn.innerHTML = "Pause";
        }

        function toggle_play_state(e) {
            if (module.animation_id) {
                stop(this);
            } else {
                start(this);
            }
        }

        function reset(e) {
            stop(startbutton);
            module.flow_vectors = false;
            module.flow_particles.length = 0;
            flowvector.checked = false;
            flowparticle.checked = false;
            module.main.init(); // Reset lattice, barriers
            module.drawing.clear();
        }

        function clear_barriers(e) {
            module.main.init_barrier([]);
            module.drawing.clear();
        }

        (function register(){
            // Register left click
            canvas.addEventListener('mousedown', mousedownListener, false);
            canvas.addEventListener('touchstart', mousedownListener, false);
            // Register right click 
            canvas.addEventListener('contextmenu', place_barrier, false);
            // Register dropdown
            var drawoptions = document.getElementById("drawmode");
            drawoptions.addEventListener('change', update_draw_mode, false);
            // Register sliders
            var viscoslider = document.getElementById("viscosity");
            viscoslider.addEventListener('input', update_viscosity, false);
            var speedslider = document.getElementById("speed");
            speedslider.addEventListener('input', update_speed, false);
            // Register checkboxes
            flowvector = document.getElementById("flowvectors");
            flowvector.addEventListener('click', toggle_vectors, false);
            flowparticle = document.getElementById("flowparticles");
            flowparticle.addEventListener('click', toggle_particles, false);
            // Register start/stop
            startbutton = document.getElementById('play');
            startbutton.addEventListener('click', toggle_play_state, false);
            // Register reset
            var resetbutton = document.getElementById('reset');
            resetbutton.addEventListener('click', reset, false);
            // Register clear barriers
            var clear = document.getElementById('clearbarriers');
            clear.addEventListener('click', clear_barriers, false);
        })();
    })();
    return module;
})(boltzmann);