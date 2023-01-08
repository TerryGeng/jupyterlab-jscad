const vec3 = require('gl-vec3');
const mat4 = require('gl-mat4');

export function getEntitiesProjectionBound(entities: any[], projectionMat4: number[], width: number, height: number) {
    let projMinX = 0;
    let projMinY = 0;
    let projMaxX = 0;
    let projMaxY = 0;

    entities.forEach((entity) => {
        const min3 = vec3.add(vec3.create(), entity.bounds.min, entity.bounds.center);
        const max3 = vec3.add(vec3.create(), entity.bounds.max, entity.bounds.center);

        const projMin4 = vec3.transformMat4(vec3.create(), min3, projectionMat4);
        const projMax4 = vec3.transformMat4(vec3.create(), max3, projectionMat4);

        projMinX = Math.min(projMin4[0], projMinX);
        projMinY = Math.min(projMin4[1], projMinY);

        projMaxX = Math.max(projMax4[0], projMaxX);
        projMaxY = Math.max(projMax4[1], projMaxY);
    });

    console.log("projMinX: ", projMinX);
    console.log("projMinY: ", projMinY);

    console.log("projMaxX: ", projMaxX);
    console.log("projMaxY: ", projMaxY);
    

    const aspect = width / height;

    const projMinXReal = projMinX * aspect * width;
    const projMinYReal = projMinY * height;

    const projMaxXReal = projMaxX * aspect * width;
    const projMaxYReal = projMaxY * height;

    return [projMaxXReal - projMinXReal, projMaxYReal - projMinYReal];
}
