import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

/**
 * Markdown 渲染：markdown-it 解析 + DOMPurify 消毒
 * 大模型输出属于不可信内容，必须消毒后再 v-html，避免 XSS
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

// 外链统一新窗口打开
const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]?.attrSet('target', '_blank')
  tokens[idx]?.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderMarkdown(source: string): string {
  const html = md.render(source)
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}
