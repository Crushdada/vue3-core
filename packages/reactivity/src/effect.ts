/**
 * 在执行fn前,记录该fn并提升到全局
 * 执行fn时，会触发其中响应式对象的get
 * 在get中，就可以将fn关联到当前属性
 * 当响应式对象的属性变化，即可执行它关联的这个fn/effect
 */
export let activeEffect = undefined;
class ReactiveEffect {
    // 表示在实例上新增active属性
    public active = true; // 默认激活状态
    // 记录当前effect依赖了哪些响应式对象
    public deps = [];
    // 标记嵌套effect情况下，上一层effect
    public parent = null;
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
            this.parent = activeEffect; // 记录之前的activeEffect
            activeEffect = this;
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
}
/**
 * 需要深度跟踪fn的依赖,依赖更新即执行传入的fn
 * @param fn 
 */
export function effect(fn) {

    // 使用一个类，扩展fn，让它能够收集依赖
    // 创建响应式effect
    const _effect = new ReactiveEffect(fn);
    // 默认先执行一次，就是为了收集依赖
    _effect.run();
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

    if (!depsMap)
        targetMap.set(target, (depsMap = new Map()))

    let dep = depsMap.get(key);
    if (!dep) depsMap.set(key, (dep = new Set()))

    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) {
        dep.add(activeEffect)
        // effect也记录对应的依赖，直接存属性对应的effect集合dep,直接存这个set引用，
        // 删除effect时，直接将其从set中删除
        activeEffect.deps.push(dep);
    }
}
