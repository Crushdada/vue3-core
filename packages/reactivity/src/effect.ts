/**
 * 在执行fn前,记录该fn并提升到全局
 * 执行fn时，会触发其中响应式对象的get
 * 在get中，就可以将fn关联到当前属性
 * 当响应式对象的属性变化，即可执行它关联的这个fn/effect
 */
export let activeEffect = undefined;
/**
 * 执行传入的fn之前要清空属性和effect之间的依赖关系
 * @param effect
 */
function cleanupEffect(effect) {
    const { deps } = effect; // deps： { set1 set2 }  其中记录各属性的set
    // 必须采用如下方式删除，而非单纯让deps=[]，因为这里需要删除双向的依赖
    for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect);
    }
    effect.deps.length = 0;
}
export class ReactiveEffect {
    // 表示在实例上新增active属性
    public active = true; // 默认激活状态
    // 记录当前effect依赖了哪些响应式对象
    public deps = [];
    // 标记嵌套effect情况下，上一层effect
    public parent = null;
    // constructor加了public的参数也会挂载到this
    constructor(public fn, public scheduler) { }
    run() {
        // 如果effect已经被关闭，只执行函数，不进行依赖收集
        if (!this.active) this.fn();
        // 依赖收集,核心是当前的effect和稍后渲染的属性关联起来
        try {
            this.parent = activeEffect; // 记录之前的activeEffect
            activeEffect = this;
            // 执行传入的用户函数之前清空依赖
            cleanupEffect(this);
            // 执行时,其依赖的响应式数据就能够保存当前的activeEffect
            return this.fn();
        } finally {
            /**
             * 如果fn是一层effect,this.parent为null,相当于将activeEffect置空
             * 如果是内部的effect,相当于将activeEffect回滚
             */
            activeEffect = this.parent;
            this.parent = null;
        }
    }
    stop() {
        if (this.active) {
            this.active = false;
            cleanupEffect(this);
        }
    }
}
/**
 * 需要深度跟踪fn的依赖,依赖更新即执行传入的fn
 * @param fn
 */
export function effect(fn, opts) {
    // 使用一个类，扩展fn，让它能够收集依赖
    // 创建响应式effect
    const _effect = new ReactiveEffect(fn, opts.scheduler);
    // 默认先执行一次，就是为了收集依赖
    _effect.run();
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}

// +++++++++++++++++ Remarks +++++++++++++++++
/**
 * 如果存在effect 嵌套的情况，即fn中使用了effect
 * 则仅使用一个引用来记录activeEffect不再合理
 * 考虑下面这种情况👇，c无法成功地进行依赖收集
 */
// effect(() => { // e1
//     state.a; // a收集了依赖e1
//     effect(() => { // e2
//         state.b; // b收集了依赖e2
//     });
//     /**
//      * 由于执行完了e2，activeEffect被置空了
//      * 因此c是无法收集到e1的
//      */
//     state.c;
// })
/**
 * 为解决此问题，vue3.0版本的做法是使用栈
 * 替代单一的遍历activeEffect，每次执行完当前fn
 * 出栈即可，但使用栈会造成性能消耗
 * 因此，后来改用树来实现
 * 考虑下面这种情况👇
 */
/**
 * 给每个effect挂载一个parent属性
 */
// effect(() => { // parent -> null activeEffect = e1
//     state.a; // a收集e1
//     effect(() => { // parent -> e1 activeEffect = e2
//         state.b; // b收集e2
//         activeEffect = this.parent;
//     });
//     state.c; // c 收集e1
// })

/**
 * 如何收集依赖呢？
 * 考虑这种情况：一个target对象，其中的部分属性可能有多个effect
 * 因此你需要这样的一种数据结构
 * {
 *   obj1: { foo: [e1,e2], bar: [e3] }
 *   obj2: { abc: [e4,e5], def: [e6] }
 * }
 * 在JS中符合上述需求的数据结构如下👇
 * 用到了WeakMap、Map、Set
 * WeakMap{
 *   obj1: Map { foo: Set(e1,e2), bar: Set(e3) }
 *   obj2: Map { abc: Set(e4,e5), def: Set(e6) }
 * }
 * 还有一个问题，当前实现的是单向的依赖收集，
 * 当删除一个effect,我们还需要清楚依赖它的响应式对象的记录
 * (一个删除effect的情况：effect里面有分支控制 ： flag ? this.foo : this.bar)
 * 因此effect应该也记录它被哪些属性收集了
 */
const targetMap = new WeakMap();
/**
 * 依赖收集
 * @param target
 * @param type
 * @param key
 */
export function track(target, type, key) {
    if (!activeEffect) return;
    let depsMap = targetMap.get(target);
    if (!depsMap) targetMap.set(target, (depsMap = new Map()));
    let dep = depsMap.get(key);
    if (!dep) depsMap.set(key, (dep = new Set()));
    trackEffects(dep);
}
export function trackEffects(dep) {
    let shouldTrack = !dep.has(activeEffect);
    if (shouldTrack) {
        dep.add(activeEffect);
        // effect也记录对应的依赖，直接存属性对应的effect集合dep,直接存这个set引用，
        // 删除effect时，直接将其从set中删除
        activeEffect.deps.push(dep);
    }
}
/**
 * 触发effect执行
 * @param target
 * @param type
 * @param key
 * @param val
 * @param oldVal
 */
export function trigger(target, type, key, val, oldVal) {
    const depsMap = targetMap.get(target);
    if (!depsMap) return; // 可能没有依赖到该属性的地方
    let effects = depsMap.get(key);
    /**
     * 考虑这种情况： effect中有一个三元运算符：const v = judge ? state.a : state.b
     * 就是说，effect中的依赖是会变动的，当judge条件不成立，原本的state.a不再被该effect所依赖
     * 因此，应当在执行用户传入的fn方法之前清楚属性和effect之间的依赖，通过执行fn重新收集
     * 考虑这种情况：Set的一个问题
     * const set = new Set();
     * set.forEach(()=> { set.delete(1); set.add(1);  })
     * 执行完删、增，set中一直会有元素，因此会导致无限循环
     * 在下面的这个effects.forEach循环中，调用了effect.run(),而run方法中先删除依赖，
     * 再执行fn重新收集的操作与上面同理，也会导致无限循环
     * 解决：执行前拷贝一份，而非关联引用
     */
    if (effects) {
        triggerEffets(effects)
    }
}
export function triggerEffets(effects) {
    effects = [...effects];
    effects.forEach((effect) => {
        // 避免递归调用当前effecf,造成栈溢出
        // 考虑这样场景：在effect中对响应式属性赋值，此时会触发trigger来更新依赖于该属性的effect
        // 问题在于当前effect也是其中之一，因此会执行当前effect，于是又一次执行了赋值操作，递归开始
        // 解决: 如果当前要执行的effect就是之前记录的activeEffect，不再执行
        if (effect !== activeEffect) {
            if (effect.scheduler) {
                effect.scheduler(); // if scheduler exists，then exec it instead of run()
            } else {
                effect.run();
            }
        }
    });
}
