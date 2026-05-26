import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SvgIcon from '../src/svg-icon.vue'

describe('SvgIcon', () => {
  it('renders an svg element for internal icon names', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'home' }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('use').exists()).toBe(true)
  })

  it('sets xlink:href to #icon-{iconClass}', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'dashboard' }
    })
    const useEl = wrapper.find('use')
    const href = useEl.attributes('xlink:href') || useEl.attributes('href')
    expect(href).toBe('#icon-dashboard')
  })

  it('applies the default svg-icon class', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'user' }
    })
    const svg = wrapper.find('svg')
    expect(svg.classes()).toContain('svg-icon')
  })

  it('appends custom className to svg classes', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'settings', className: 'custom-class' }
    })
    const svg = wrapper.find('svg')
    expect(svg.classes()).toContain('svg-icon')
    expect(svg.classes()).toContain('custom-class')
  })

  it('does not include className when not provided', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'menu' }
    })
    const svg = wrapper.find('svg')
    expect(svg.classes()).toEqual(['svg-icon'])
  })

  it('sets aria-hidden on the svg element', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'close' }
    })
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('renders an external icon as a div with mask style for http URLs', () => {
    const url = 'https://example.com/icon.svg'
    const wrapper = mount(SvgIcon, {
      props: { iconClass: url }
    })
    expect(wrapper.find('svg').exists()).toBe(false)
    const div = wrapper.find('div')
    expect(div.exists()).toBe(true)
    expect(div.classes()).toContain('svg-external-icon')
    expect(div.classes()).toContain('svg-icon')
    const style = div.attributes('style')
    expect(style).toContain(`url(${url})`)
    expect(style).toContain('no-repeat 50% 50%')
  })

  it('renders an external icon for http:// URLs', () => {
    const url = 'http://cdn.example.com/icons/star.svg'
    const wrapper = mount(SvgIcon, {
      props: { iconClass: url }
    })
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('treats mailto: links as external', () => {
    const mailto = 'mailto:test@example.com'
    const wrapper = mount(SvgIcon, {
      props: { iconClass: mailto }
    })
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('treats tel: links as external', () => {
    const tel = 'tel:+1234567890'
    const wrapper = mount(SvgIcon, {
      props: { iconClass: tel }
    })
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('does not treat relative paths as external', () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'local-icon' }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(false)
  })

  it('renders svg with correct href when iconClass changes', async () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'first' }
    })
    const getHref = () => {
      const el = wrapper.find('use')
      return el.attributes('xlink:href') || el.attributes('href')
    }
    expect(getHref()).toBe('#icon-first')

    await wrapper.setProps({ iconClass: 'second' })
    expect(getHref()).toBe('#icon-second')
  })

  it('switches from internal to external when iconClass changes to URL', async () => {
    const wrapper = mount(SvgIcon, {
      props: { iconClass: 'internal-icon' }
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(false)

    await wrapper.setProps({ iconClass: 'https://cdn.example.com/icon.svg' })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.find('div.svg-external-icon').exists()).toBe(true)
  })
})
