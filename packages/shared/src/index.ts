export const isObject = (val) => {
    return typeof val === 'object' && val !== null;
}
export const isString = (val) => {
    return typeof val === 'string';
}
export const isNumber = (val) => {
    return typeof val === 'number';
}
export const isFunction = (val) => {
    return typeof val === 'function';
}
export const isArray = Array.isArray;
export const assign = Object.assign;
