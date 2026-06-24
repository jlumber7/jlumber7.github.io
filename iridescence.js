import {
    Renderer,
    Program,
    Mesh,
    Color,
    Triangle
} from 'https://cdn.jsdelivr.net/npm/ogl/+esm';

const container = document.getElementById('iridescence-bg');

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform float uSpeed;

varying vec2 vUv;

void main() {

    float mr = min(uResolution.x, uResolution.y);

    vec2 uv =
        (vUv * 2.0 - 1.0)
        * uResolution.xy
        / mr;

    float d = -uTime * 0.5 * uSpeed;
    float a = 0.0;

    for(float i = 0.0; i < 8.0; ++i) {
        a += cos(i - d - a * uv.x);
        d += sin(uv.y * i + a);
    }

    d += uTime * 0.5 * uSpeed;

    vec3 col = vec3(
        cos(uv * vec2(d, a)) * 0.6 + 0.4,
        cos(a + d) * 0.5 + 0.5
    );

    col =
        cos(
            col * cos(vec3(d, a, 2.5))
            * 0.5
            + 0.5
        ) * uColor;

    gl_FragColor = vec4(col, 1.0);
}
`;

const renderer = new Renderer({
    dpr: Math.min(window.devicePixelRatio, 2)
});

const gl = renderer.gl;

container.appendChild(gl.canvas);

const geometry = new Triangle(gl);

const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
        uTime: { value: 0 },

        uColor: {
            value: new Color(
                0.9294117647058824,
                0.803921568627451,
                0.40784313725490196
            )
        },

        uResolution: {
            value: new Color()
        },

        uSpeed: {
            value: 0.5
        }
    }
});

const mesh = new Mesh(gl, {
    geometry,
    program
});

function resize() {

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    program.uniforms.uResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height
    );
}

window.addEventListener('resize', resize);

resize();

function animate(time) {

    requestAnimationFrame(animate);

    program.uniforms.uTime.value =
        time * 0.001;

    renderer.render({
        scene: mesh
    });
}

requestAnimationFrame(animate);