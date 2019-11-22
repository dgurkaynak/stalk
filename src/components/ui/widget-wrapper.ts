import { Widget } from 'phosphor-widget';
import isBoolean from 'lodash/isBoolean';

export interface WidgetWrapperOptions {
  title: string;
  closable?: boolean;
  onResize?: (msg: { width: number; height: number }) => void;
  onClose?: () => void;
}

// A tiny wrapper around phosphor-widget
export class WidgetWrapper extends Widget {
  constructor(private options: WidgetWrapperOptions) {
    super();

    this.title.text = options.title;
    this.title.closable = isBoolean(options.closable) ? options.closable : true;
  }

  protected onResize(msg) {
    this.options.onResize && this.options.onResize(msg);
  }

  protected onCloseRequest(msg) {
    super.onCloseRequest(msg);
    this.options.onClose && this.options.onClose();
  }

  empty() {
    let child = this.node.firstChild;
    while (child) {
      this.node.removeChild(child);
    }
  }
}
