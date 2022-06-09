import { isObject } from '@vue/shared'
export function reactive(target) {
    if (!isObject(target)) return
    // 对象代理，取值触发get，赋值触发set
    const proxy = new Proxy(target, {
        get(target, key, receiver) {
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            return Reflect.set(target, key, value, receiver)
        }
    });

    return proxy;
}