import { isObject } from '@vue/shared'
// 每次代理同一对象，都会new返回新的代理对象，
// 为避免内存浪费，使用weakmap做缓存
const reactiveMap = new WeakMap();
export function reactive(target) {
    if (!isObject(target)) return

    let existingProxy = reactiveMap.get(target);
    if (existingProxy) return existingProxy;
    // 对象代理，取值触发get，赋值触发set
    const proxy = new Proxy(target, {
        get(target, key, receiver) {
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            return Reflect.set(target, key, value, receiver)
        }
    });
    // 弱引用, 无泄漏, 当target==null, 自动删除两者之间的引用关系
    reactiveMap.set(target, proxy);
    return proxy;
}
