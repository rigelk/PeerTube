/*
 * -- LinkService --        [Temporary]
 * thanks to https://github.com/angular/angular/issues/15776#issuecomment-291862953
 *
 * Similar to Meta service but made to handle <link> creation
 * -- NOTE: Soon there will be an overall DocumentService within Angular that handles Meta/Link
 */

import { Injectable, Optional, RendererFactory2, ViewEncapsulation, Inject } from '@angular/core'
import { DOCUMENT } from '@angular/platform-browser'

@Injectable()
export class LinkService {

  constructor (
      private rendererFactory: RendererFactory2,
      @Inject(DOCUMENT) private document
  ) {}

  updateTag (tag: LinkDefinition) {
    this.removeTag(tag)
    this.addTag(tag)
  }

  /**
   * Inject the State into the bottom of the <head>
   */
  addTag (tag: LinkDefinition, forceCreation?: boolean) {

    try {
      const renderer = this.rendererFactory.createRenderer(this.document, {
        id: '-1',
        encapsulation: ViewEncapsulation.None,
        styles: [],
        data: {}
      })

      const link = renderer.createElement('link')
      const head = this.document.head
      const selector = this._parseSelector(tag)

      if (head === null) {
        throw new Error('<head> not found within DOCUMENT.')
      }

      Object.keys(tag).forEach((prop: string) => {
        return renderer.setAttribute(link, prop, tag[prop])
      })

      console.log(this.document.querySelectorAll(`link[rel="alternate"]`))
      renderer.appendChild(head, link)

    } catch (e) {
      console.error('Error within linkService : ', e)
    }
  }

  /**
   * Remove the State from the bottom of the <head>
   */
  removeTag (tag: LinkDefinition) {

    try {
      const renderer = this.rendererFactory.createRenderer(this.document, {
        id: '-1',
        encapsulation: ViewEncapsulation.None,
        styles: [],
        data: {}
      })

      const selector = this._parseSelector(tag)
      // console.log('INFO: selector is ',selector)
      const canonical = this.document.querySelector(`link${selector}`)
      console.log(canonical, `link${selector}`)
      // console.log('INFO: canonical is ',canonical ? canonical : undefined)
      const head = this.document.head

      if (head === null) {
        throw new Error('<head> not found within DOCUMENT.')
      }
      if (canonical) {
        renderer.removeChild(head, canonical)
      }
    } catch (e) {
      console.error('Error within linkService : ', e)
    }
  }

  /**
   * Remove the matching State(s) from the bottom of the <head>
   */
  removeTagFromSelector (attrSelector: string) {
    try {
      const renderer = this.rendererFactory.createRenderer(this.document, {
        id: '-1',
        encapsulation: ViewEncapsulation.None,
        styles: [],
        data: {}
      })

      const head = this.document.head
      if (head === null) {
        throw new Error('<head> not found within DOCUMENT.')
      }

      const linkTags = this.document.querySelectorAll('link[' + attrSelector + ']')
      for (const link of linkTags) {
        renderer.removeChild(head, link)
      }
    } catch (e) {
      console.log('Error while removing tag ' + e.message)
    }
  }

  private _parseSelector (tag: LinkDefinition): string {
    // Possibly re-work this
    const attr: string = tag.rel ? 'rel' : 'hreflang'
    return `[${attr}="${tag[attr]}"]` + (tag.type ? `[type="${tag['type']}"]` : '') + (tag.title ? `[title="${tag['title']}"]` : '')
  }
}

export declare type LinkDefinition = {
  charset?: string;
  crossorigin?: string;
  href?: string;
  hreflang?: string;
  media?: string;
  rel?: string;
  rev?: string;
  sizes?: string;
  target?: string;
  type?: string;
} & {
  [prop: string]: string;
}
