// Smooth fade-in effect on page load
        document.addEventListener("DOMContentLoaded", function () {
            document.body.style.opacity = "1";

            // Smooth scrolling for navigation links
            const links = document.querySelectorAll(".scroll-link");

            links.forEach(link => {
                link.addEventListener("click", function (event) {
                    event.preventDefault();
                    const targetId = this.getAttribute("href").substring(1);
                    const targetSection = document.getElementById(targetId);

                    if (targetSection) {
                        window.scrollTo({
                            top: targetSection.offsetTop - 50, // Offset for better visibility
                            behavior: "smooth"
                        });
                    }
                });
            });
        });


//Code for Portfolio Carousel Effect
let lastUpdateTime = Date.now();
let colourUpdateTimer = 0.0;

let config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1440,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 3.5,
    VELOCITY_DISSIPATION: 2,
    PRESSURE: 0.1,
    PRESSURE_ITERATIONS: 20,
    CURL: 10,
    SPLAT_RADIUS: 0.5,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLOUR_UPDATE_SPEED: 10,
    PAUSED: false,
    BACK_COLOUR: {r: 0, g: 0, b: 0},
    TRANSPARENT: true
}