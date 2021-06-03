import { Data } from '../component'
import { Slots, RawSlots } from '../componentSlots'
import { ContextualRenderFn } from '../componentRenderContext'
import { Comment, isVNode } from '../vnode'
import {
  VNodeArrayChildren,
  openBlock,
  createBlock,
  Fragment,
  VNode
} from '../vnode'
import { PatchFlags, SlotFlags } from '@vue/shared'
import { warn } from '../warning'

/**
 * <slot>fallback content</slot>
 * Compiler runtime helper for rendering `<slot/>`
 * @private
 */
export function renderSlot(
  slots: Slots,
  name: string,
  props: Data = {},
  // this is not a user-facing function, so the fallback is always generated by
  // the compiler and guaranteed to be a function returning an array
  fallback?: () => VNodeArrayChildren,
  noSlotted?: boolean
): VNode {
  let slot = slots[name] // NOTICE: slot总是返回一个函数, (props) => []

  if (__DEV__ && slot && slot.length > 1) {
    warn(
      `SSR-optimized slot function detected in a non-SSR-optimized render ` +
        `function. You need to mark this component with $dynamic-slots in the ` +
        `parent template.`
    )
    slot = () => []
  }

  // a compiled slot disables block tracking by default to avoid manual
  // invocation interfering with template-based block tracking, but in
  // `renderSlot` we can be sure that it's template-based so we can force
  // enable it.
  if (slot && (slot as ContextualRenderFn)._c) {
    ;(slot as ContextualRenderFn)._d = false
  }
  openBlock()
  const validSlotContent = slot && ensureValidVNode(slot(props))
  const rendered = createBlock(
    Fragment,
    { key: props.key || `_${name}` },
    validSlotContent || (fallback ? fallback() : []),
    validSlotContent && (slots as RawSlots)._ === SlotFlags.STABLE
      ? PatchFlags.STABLE_FRAGMENT
      : PatchFlags.BAIL
  )
  if (!noSlotted && rendered.scopeId) {
    rendered.slotScopeIds = [rendered.scopeId + '-s']
  }
  if (slot && (slot as ContextualRenderFn)._c) {
    ;(slot as ContextualRenderFn)._d = true
  }
  return rendered
}

function ensureValidVNode(vnodes: VNodeArrayChildren) {
  return vnodes.some(child => {
    if (!isVNode(child)) return true
    if (child.type === Comment) return false
    if (
      child.type === Fragment &&
      !ensureValidVNode(child.children as VNodeArrayChildren)
    )
      return false
    return true
  })
    ? vnodes
    : null
}
