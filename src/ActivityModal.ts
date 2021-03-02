/** @format */

import { App, ButtonComponent, Modal, TextComponent } from 'obsidian'

class ActivityModal extends Modal {
  constructor(app: App) {
    super(app)
  }

  onOpen() {
    let _this: Modal = this
    console.debug(_this)
    let {contentEl} = this;
    let inputFromDateField = new TextComponent(contentEl).setPlaceholder('From')
    let inputToDateField = new TextComponent(contentEl).setPlaceholder('To')
    let inputButton = new ButtonComponent(contentEl).setButtonText('Get Stats').onClick(() => {
      let inputFromDate = inputFromDateField.getValue()
      let inputToDate = inputToDateField.getValue()
      _this.app
    })
  }
}
