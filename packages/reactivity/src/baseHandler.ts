import { isObject } from '@vue/shared';
import { track, trigger } from './effect'
import { reactive } from './reactive';
export const enum ReactiveFlags {
    IS_REACTIVE = "__v_isReactive"
}
export const mutableHandlers = {
    get(target, key, receiver) {
        if (key === ReactiveFlags.IS_REACTIVE) return true;
        track(target, 'get', key);
        let res = Reflect.get(target, key, receiver);
        if (isObject(res)) {
            return reactive(res); // 深度代理
        }
        return res;
    },
    set(target, key, value, receiver) {
        const oldVal = target[key];
        const result = Reflect.set(target, key, value, receiver);
        if (oldVal !== value) {
            // 更新
            trigger(target, 'set', key, value, oldVal)
        }
        return result;
    }
}

