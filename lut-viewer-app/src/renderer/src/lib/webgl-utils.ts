export class LUTRenderer {
    gl: WebGL2RenderingContext
    program: WebGLProgram | null = null
    vao: WebGLVertexArrayObject | null = null
    textureVideo: WebGLTexture | null = null
    textureLUT: WebGLTexture | null = null
    lastError: string = ""

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl
    }

    compileShader(src: string, type: number): WebGLShader | null {
        const shader = this.gl.createShader(type)
        if (!shader) {
            this.lastError = "Failed to create shader object"
            return null
        }
        this.gl.shaderSource(shader, src)
        this.gl.compileShader(shader)
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const log = this.gl.getShaderInfoLog(shader)
            console.error("Shader compile error:", log)
            this.lastError = `Shader compile error: ${log}`
            this.gl.deleteShader(shader)
            return null
        }
        return shader
    }

    init(vsSrc: string, fsSrc: string) {
        this.lastError = ""
        const vs = this.compileShader(vsSrc, this.gl.VERTEX_SHADER)
        if (!vs) return // error already set

        const fs = this.compileShader(fsSrc, this.gl.FRAGMENT_SHADER)
        if (!fs) return // error already set

        this.program = this.gl.createProgram()
        if (!this.program) {
            this.lastError = "Failed to create program"
            return
        }
        this.gl.attachShader(this.program, vs)
        this.gl.attachShader(this.program, fs)
        this.gl.linkProgram(this.program)

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            const log = this.gl.getProgramInfoLog(this.program)
            console.error("Program link error:", log)
            this.lastError = `Program link error: ${log}`
            return
        }

        // Fullscreen Quad
        const positions = new Float32Array([
            -1, -1, 0, 0,
            1, -1, 1, 0,
            -1, 1, 0, 1,
            -1, 1, 0, 1,
            1, -1, 1, 0,
            1, 1, 1, 1,
        ])

        this.vao = this.gl.createVertexArray()
        this.gl.bindVertexArray(this.vao)

        const buf = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf)
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)

        const prog = this.program

        const locPos = this.gl.getAttribLocation(prog, "a_position")
        this.gl.enableVertexAttribArray(locPos)
        this.gl.vertexAttribPointer(locPos, 2, this.gl.FLOAT, false, 16, 0)

        const locTex = this.gl.getAttribLocation(prog, "a_texCoord")
        this.gl.enableVertexAttribArray(locTex)
        this.gl.vertexAttribPointer(locTex, 2, this.gl.FLOAT, false, 16, 8)

        // Init Textures
        this.textureVideo = this.createTexture()
        this.textureLUT = this.create3DTexture()
    }

    createTexture() {
        const tex = this.gl.createTexture()
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
        return tex
    }

    create3DTexture() {
        // Need to be cautious with 3D texture support, WebGL2 standard
        const tex = this.gl.createTexture()
        this.gl.bindTexture(this.gl.TEXTURE_3D, tex)
        this.gl.texParameteri(this.gl.TEXTURE_3D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_3D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_3D, this.gl.TEXTURE_WRAP_R, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_3D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
        this.gl.texParameteri(this.gl.TEXTURE_3D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
        return tex
    }

    updateVideoTexture(video: HTMLVideoElement) {
        if (!this.textureVideo) return
        this.gl.activeTexture(this.gl.TEXTURE0)
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureVideo)
        // Flip Y for video source to match WebGL coordinates
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true)
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, video)
    }

    loadLut(data: Uint8Array, size: number) {
        if (!this.textureLUT) return
        this.gl.activeTexture(this.gl.TEXTURE1)
        this.gl.bindTexture(this.gl.TEXTURE_3D, this.textureLUT)
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1)
        // Ensure NO flip for LUT data (it's already structured correctly)
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false)
        this.gl.texImage3D(
            this.gl.TEXTURE_3D,
            0,
            this.gl.RGB8,
            size,
            size,
            size,
            0,
            this.gl.RGB,
            this.gl.UNSIGNED_BYTE,
            data
        )
    }

    draw(intensity: number, bypass: boolean, grade: { exposure: number, contrast: number, saturation: number, highlights: number, shadows: number } = { exposure: 0, contrast: 1, saturation: 1, highlights: 0, shadows: 0 }, showDebugBars: boolean = false) {
        if (!this.program || !this.vao) return
        this.gl.useProgram(this.program)
        this.gl.bindVertexArray(this.vao)

        // Uniforms
        const uVideo = this.gl.getUniformLocation(this.program, "u_image")
        const uLut = this.gl.getUniformLocation(this.program, "u_lut")
        const uInt = this.gl.getUniformLocation(this.program, "u_intensity")
        const uByp = this.gl.getUniformLocation(this.program, "u_bypass")
        const uDbg = this.gl.getUniformLocation(this.program, "u_debug")

        // Grade Uniforms (if matched in shader, otherwise ignored)
        const uExp = this.gl.getUniformLocation(this.program, "u_exposure")
        const uCon = this.gl.getUniformLocation(this.program, "u_contrast")
        const uSat = this.gl.getUniformLocation(this.program, "u_saturation")
        const uHigh = this.gl.getUniformLocation(this.program, "u_highlights")
        const uShadow = this.gl.getUniformLocation(this.program, "u_shadows")

        this.gl.uniform1i(uVideo, 0)
        this.gl.uniform1i(uLut, 1)
        this.gl.uniform1f(uInt, intensity)
        this.gl.uniform1i(uByp, bypass ? 1 : 0)
        this.gl.uniform1i(uDbg, showDebugBars ? 1 : 0)

        this.gl.uniform1f(uExp, grade.exposure)
        this.gl.uniform1f(uCon, grade.contrast)
        this.gl.uniform1f(uSat, grade.saturation)
        this.gl.uniform1f(uHigh, grade.highlights)
        this.gl.uniform1f(uShadow, grade.shadows)

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    }
}
