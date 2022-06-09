export let activeEffect = undefined;
class ReactiveEffect {
    // 表示在实例上新增active属性
    public active = true; // 默认激活状态
    // constructor加了public的参数也会挂载到this
    constructor(public fn) { }
    run() {
        // 如果effect已经被关闭，只执行函数，不进行依赖收集
        if (!this.active) this.fn();
        /**
         * 依赖收集
         * 核心是当前的effect和稍后渲染的属性关联起来
         */
        try {
            activeEffect = this;
            // 执行时，其依赖的响应式数据就能够保存当前的activeEffect
            return this.fn();
        } finally {
            activeEffect = undefined;
        }
    }
}
export function effect(fn) {
    // 需要深度跟踪fn的依赖，依赖更新即执行传入的fn
    // 创建响应式effect
    const _effect = new ReactiveEffect(fn);
    // 默认先执行一次
    _effect.run();
}