/** @format */

import { App, ButtonComponent, Modal, TextComponent } from 'obsidian'
import DailyActivityPlugin from '../main'

export default class ActivityModal extends Modal {
  plugin: DailyActivityPlugin

  constructor(app: App, plugin: DailyActivityPlugin) {
    super(app)
    this.plugin = plugin
  }

  onOpen() {
    this.plugin.logger.debug('Opening activity modal')
    let _this: Modal = this
    let { contentEl } = this;
    let inputFromDateField = new TextComponent(contentEl).setPlaceholder('From')
    let inputToDateField = new TextComponent(contentEl).setPlaceholder('To')
    let inputButton = new ButtonComponent(contentEl).setButtonText('Get Stats').onClick(() => {
      let inputFromDate = inputFromDateField.getValue()
      let inputToDate = inputToDateField.getValue()
      _this.app
    })
  }
}
