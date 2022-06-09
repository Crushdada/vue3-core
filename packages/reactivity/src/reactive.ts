import { isObject } from '@vue/shared'
// 每次代理同一对象，都会new返回新的代理对象，
// 为避免内存浪费，使用weakmap做缓存
const reactiveMap = new WeakMap();

const enum ReactiveFlags {
    IS_REACTIVE = "__v_isReactive"
}
export function reactive(target) {
    if (!isObject(target)) return
    /**  
     * 如果传入的已经是一个proxy的,则return 该proxy本身
     * target === proxy, 取IS_REACTIVE的值会触发proxy的get
     * key === IS_REACTIVE，get返回true,判定生效，return target
     */
    if (target[ReactiveFlags.IS_REACTIVE]) return target;
    let existingProxy = reactiveMap.get(target);
    if (existingProxy) return existingProxy;
    // 对象代理，取值触发get，赋值触发set
    const proxy = new Proxy(target, {
        get(target, key, receiver) {
            if (key === ReactiveFlags.IS_REACTIVE) return true;
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
