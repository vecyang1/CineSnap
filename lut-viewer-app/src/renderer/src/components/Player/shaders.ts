export const vertexShaderSource = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;
  precision highp sampler3D;
  in vec2 v_texCoord;
  out vec4 outColor;
  uniform sampler2D u_image;
  uniform sampler3D u_lut;
  uniform float u_intensity;
  uniform bool u_bypass;
  uniform bool u_debug;
  
  // Color Grade Uniforms
  uniform float u_exposure;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_highlights;
  uniform float u_shadows;
  
  const vec3 luma = vec3(0.2126, 0.7152, 0.0722);

  void main() {
    vec4 texColor = texture(u_image, v_texCoord);
    vec3 color = texColor.rgb;
    
    // --- 1. Exposure ---
    color *= pow(2.0, u_exposure);
    
    // --- 2. Contrast ---
    color = (color - 0.5) * u_contrast + 0.5;
    
    // --- 3. Saturation ---
    float luminance = dot(color, luma);
    color = mix(vec3(luminance), color, u_saturation);
    
    // --- 4. Shadows / Highlights ---
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, luminance);
    float highlightMask = smoothstep(0.5, 1.0, luminance);
    color += u_shadows * 0.5 * shadowMask;
    color += u_highlights * 0.5 * highlightMask;
    
    color = clamp(color, 0.0, 1.0);
    
    vec3 processedColor = color;

    // LUT Application
    if (!u_bypass) {
        vec3 lutColor = texture(u_lut, color).rgb;
        processedColor = mix(color, lutColor, u_intensity);
    }

    outColor = vec4(processedColor, texColor.a);
    
    // --- DEBUG VISUALIZATION ---
    if (u_debug) {
        // Bar 1 (0.0-0.02): Red if Bypass is TRUE, Black if False
        if (v_texCoord.x < 0.02) {
            if (u_bypass) outColor = vec4(1.0, 0.0, 0.0, 1.0); // RED = Bypass ON
            else outColor = vec4(0.0, 0.0, 0.0, 1.0);          // Black = Bypass OFF
        }
        // Bar 2 (0.02-0.04): Green if Bypass is FALSE (Active)
        else if (v_texCoord.x < 0.04) {
            if (!u_bypass) outColor = vec4(0.0, 1.0, 0.0, 1.0); // GREEN = Active
        }
        // Bar 3 (0.04-0.06): Blue if LUT texture is bound/working (sample center)
        else if (v_texCoord.x < 0.06) {
            vec3 testSample = texture(u_lut, vec3(0.5, 0.5, 0.5)).rgb;
            if (length(testSample) > 0.0) outColor = vec4(0.0, 0.0, 1.0, 1.0); // BLUE = LUT Data Exists
        }
    }
  }
`;
