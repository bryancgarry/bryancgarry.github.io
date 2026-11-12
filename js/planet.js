// Animated ringed planet in the hero, drawn with a WebGL fragment shader.
// Every pixel of the canvas runs the shader below: it ray-casts a sphere,
// paints noise-based cloud bands that rotate over time, lights it from the
// upper left, and adds an atmosphere glow plus a ring in front of and behind it.

const vertexSource = `
attribute vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const fragmentSource = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

const float R = 0.5;          // planet radius (canvas spans -1..1)
const float TILT = 0.32;      // screen tilt of the ring and the planet's axis
const float RING_FLAT = 0.22; // how flattened the ring ellipse looks

const vec3 ORANGE = vec3(0.996, 0.498, 0.176);
const vec3 DARK   = vec3(0.55, 0.24, 0.09);
const vec3 LIGHT  = vec3(1.0, 0.75, 0.55);
const vec3 SLATE  = vec3(0.137, 0.239, 0.302);

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
}

float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 p = gl_FragCoord.xy / uRes * 2.0 - 1.0;
    float r = length(p);

    // Colors are premultiplied by alpha so the canvas blends over the stars
    vec3 col = vec3(0.0);
    float alpha = 0.0;

    // Atmosphere glow outside the planet
    float glow = exp(-max(r - R, 0.0) * 9.0) * 0.45;
    col += ORANGE * glow;
    alpha += glow;

    // Ring: an ellipse in tilted screen space, with fine bands and one gap
    vec2 q = rot(TILT) * p;
    float ringR = length(vec2(q.x, q.y / RING_FLAT));
    float ringMask = smoothstep(0.68, 0.70, ringR) * (1.0 - smoothstep(0.93, 0.95, ringR));
    float ringGap = 1.0 - 0.8 * smoothstep(0.80, 0.805, ringR) * (1.0 - smoothstep(0.83, 0.835, ringR));
    float ringA = ringMask * ringGap * (0.55 + 0.45 * sin(ringR * 90.0)) * 0.75;
    vec3 ringCol = mix(ORANGE, LIGHT, 0.3);

    // Back half of the ring goes behind the planet
    if (q.y > 0.0) {
        col = mix(col, ringCol, ringA);
        alpha = mix(alpha, 1.0, ringA);
    }

    if (r < R) {
        vec3 n = vec3(p, sqrt(R * R - r * r)) / R;

        // Turn the surface normal into planet coordinates: tilt, then spin
        vec3 m = n;
        m.xy = rot(TILT) * m.xy;
        m.yz = rot(-RING_FLAT) * m.yz;
        m.xz = rot(uTime * 0.08) * m.xz;

        float turb = fbm(m * 3.0 + vec3(0.0, 0.0, uTime * 0.02));
        float bands = 0.6 * sin(m.y * 9.0 + turb * 3.0) + 0.4 * sin(m.y * 23.0 + turb * 5.0);
        vec3 surf = mix(DARK, ORANGE, smoothstep(-0.9, 0.9, bands));
        surf = mix(surf, LIGHT, smoothstep(0.5, 0.85, fbm(m * 8.0)) * 0.4);
        surf = mix(surf, SLATE, smoothstep(0.4, 1.0, -bands) * 0.3);

        float shade = smoothstep(-0.15, 0.6, dot(n, normalize(vec3(-0.6, 0.5, 0.7))));
        float rim = pow(1.0 - n.z, 3.0);
        vec3 lit = surf * (0.08 + 0.95 * shade) + ORANGE * rim * (0.15 + 0.6 * shade);

        float edge = smoothstep(R, R - 0.006, r);
        col = mix(col, lit, edge);
        alpha = mix(alpha, 1.0, edge);
    }

    // Front half of the ring goes over the planet
    if (q.y <= 0.0) {
        col = mix(col, ringCol, ringA);
        alpha = mix(alpha, 1.0, ringA);
    }

    gl_FragColor = vec4(col, alpha);
}`;

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function startPlanet() {
    const canvas = document.getElementById("planet");
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });

    // No WebGL: hide the canvas and the page still works
    if (!gl) {
        canvas.style.display = "none";
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    // One triangle big enough to cover the whole canvas
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");

    function render(ms) {
        const scale = Math.min(window.devicePixelRatio, 2);
        const size = Math.round(canvas.clientWidth * scale);
        if (canvas.width !== size) {
            canvas.width = size;
            canvas.height = size;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, ms / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Visitors who turn off animations get one still frame
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        render(20000);
        window.addEventListener("resize", () => render(20000));
        return;
    }

    function loop(ms) {
        render(ms);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

startPlanet();
