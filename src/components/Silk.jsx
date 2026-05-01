import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

// Silk fragment shader ported from reactbits.dev/backgrounds/silk to ogl
// (the project already depends on ogl; using @react-three/fiber would add ~600kb).
const vertex = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uRotation;
  uniform float uNoiseIntensity;

  const float e = 2.71828182845904523536;

  float noise(vec2 texCoord) {
    float G = e;
    vec2  r = (G * sin(G * texCoord));
    return fract(r.x * r.y * (1.0 + texCoord.x));
  }

  vec2 rotateUvs(vec2 uv, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat2  rot = mat2(c, -s, s, c);
    return rot * uv;
  }

  void main() {
    float rnd     = noise(gl_FragCoord.xy);
    vec2  uv      = rotateUvs(vUv * uScale, uRotation);
    vec2  tex     = uv * uScale;
    float tOffset = uSpeed * uTime;

    tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

    float pattern = 0.6 +
                    0.4 * sin(5.0 * (tex.x + tex.y +
                                     cos(3.0 * tex.x + 5.0 * tex.y) +
                                     0.02 * tOffset) +
                             sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

    vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
    col.a = 1.0;
    gl_FragColor = col;
  }
`;

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

export default function Silk({
  speed = 5,
  scale = 1,
  color = '#7B7481',
  noiseIntensity = 1.5,
  rotation = 0,
  ...props
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const renderer = new Renderer({ antialias: true, alpha: false, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Float32Array(hexToRgb(color)) },
        uSpeed: { value: speed },
        uScale: { value: scale },
        uRotation: { value: rotation },
        uNoiseIntensity: { value: noiseIntensity },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
    }
    window.addEventListener('resize', resize);
    resize();

    let raf;
    let last = performance.now();
    function update(now) {
      raf = requestAnimationFrame(update);
      const delta = (now - last) / 1000;
      last = now;
      // Match the r3f reference: uTime advances at 0.1 * delta * speed-equivalent.
      // The shader scales by uSpeed itself, so we just feed real seconds * 0.1.
      program.uniforms.uTime.value += delta * 0.1;
      renderer.render({ scene: mesh });
    }
    raf = requestAnimationFrame(update);

    container.appendChild(gl.canvas);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (gl.canvas.parentElement) gl.canvas.parentElement.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color, speed, scale, rotation, noiseIntensity]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} {...props} />;
}
