export default function(params) {
    return `
    #version 100
    precision highp float;
  
    uniform sampler2D u_gbuffers[${params.numGBuffers}];

    uniform sampler2D u_lightbuffer;
    uniform sampler2D u_clusterbuffer;

    uniform mat4 u_viewMatrix;

    uniform int   u_width;
    uniform int   u_height;
    uniform float u_depth;
    uniform int   u_xSlices;
    uniform int   u_ySlices;
    uniform int   u_zSlices;
    uniform int   u_numClusters;


    varying vec2 v_uv;

    struct Light {
        vec3 position;
        float radius;
        vec3 color;
    };

    float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
        float u = float(index + 1) / float(textureWidth + 1);
        int pixel = component / 4;
        float v = float(pixel + 1) / float(textureHeight + 1);
        vec4 texel = texture2D(texture, vec2(u, v));
        int pixelComponent = component - pixel * 4;
        if (pixelComponent == 0) {
            return texel[0];
        } else if (pixelComponent == 1) {
            return texel[1];
        } else if (pixelComponent == 2) {
            return texel[2];
        } else if (pixelComponent == 3) {
            return texel[3];
        }
    }

    Light UnpackLight(int index) {
        Light light;
        float u = float(index + 1) / float(${params.numLights + 1});
        vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
        vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
        light.position = v1.xyz;

        // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
        // Note that this is just an example implementation to extract one float.
        // There are more efficient ways if you need adjacent values
        light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

        light.color = v2.rgb;
            return light;
        }

        // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
        float cubicGaussian(float h) {
        if (h < 1.0) {
            return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
        } else if (h < 2.0) {
            return 0.25 * pow(2.0 - h, 3.0);
        } else {
            return 0.0;
        }
    }


    void main() {
        // TODO: extract data from g buffers and do lighting
        vec4 v_albedo = texture2D(u_gbuffers[0], v_uv);
        vec3 albedo = vec3(v_albedo);
        vec4 v_position = texture2D(u_gbuffers[1], v_uv);
        vec3 position = vec3(v_position);
        vec4 v_normal = texture2D(u_gbuffers[2], v_uv);
        vec3 normal = vec3(v_normal);
        // vec4 spe = texture2D(u_gbuffers[3], v_uv);

        vec3 fragColor = vec3(0.0);

        int xIdx = int(gl_FragCoord.x / float(u_width) * float(u_xSlices));
        int yIdx = int(gl_FragCoord.y / float(u_height) * float(u_ySlices));
        int zIdx = int((u_viewMatrix * vec4(position, 1)).z / u_depth * float(u_zSlices));
        int Idx = xIdx + yIdx * u_xSlices + zIdx * u_xSlices * u_ySlices;

        int textureHeight = int(ceil(float(${params.numLights + 1}) / 4.0));
        int numLights = int(ExtractFloat(u_clusterbuffer, u_numClusters, textureHeight, Idx, 0));


        for (int i = 0; i < ${params.numLights}; i++) {
            if (i >= numLights) break;
            int lt = int(ExtractFloat(u_clusterbuffer, u_numClusters, textureHeight, Idx, i + 1));
            Light light = UnpackLight(lt);
            float lightDistance = distance(light.position, position);
            vec3 L = (light.position - position) / lightDistance;

            float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
            float lambertTerm = max(dot(L, normal), 0.0);

            fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
        }

        const vec3 ambientLight = vec3(0.025);
        fragColor += albedo * ambientLight;

        gl_FragColor = vec4(fragColor, 1.0);
        //gl_FragColor = vec4(normalize(normal), 1.0);
    }
  `;
}