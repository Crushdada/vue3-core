import { isFunction } from "@vue/shared"
import { ReactiveEffect, trackEffects, triggerEffets } from "./effect";

class ComputedRefIml {
    public effect;
    public _dirty = true;
    public __v_isReadonly = true;
    public __v_isRef = true;
    public _value;
    public dep = new Set;
    constructor(public getter, public setter) {
        // 计算属性是基于effect实现的
        this.effect = new ReactiveEffect(getter, () => {
            if (!this._dirty) {
                this._dirty = true;
                // 触发更新
                triggerEffets(this.dep)
            }
        });
    }
    // 类的属性访问器，基于es5的defineProperty实现
    get() {
        // 依赖收集
        trackEffects(this.dep);
        if (this._dirty) {
            this._dirty = false; // 实现computed的缓存，仅当dirty时，才重新计算
            this._value = this.effect.run();
        }
        return this._value;
    }
    set(newVal) {
        this.setter(newVal);
    }
}
/**
 * 通过判断参数类型实现多态(getter或opt)
 */
export const computed = (getterOrOptions) => {
    let isOnlyGetter = isFunction(getterOrOptions);
    let getter;
    let setter;
    if (isOnlyGetter) {
        getter = getterOrOptions;
        setter = () => { console.log('no set') }
    } else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
        return new ComputedRefIml(getter, setter)
    }
};