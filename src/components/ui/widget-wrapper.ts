import { Widget } from '@phosphor/widgets';
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

    this.title.label = options.title;
    this.title.closable = isBoolean(options.closable) ? options.closable : true;
  }

  protected onResize(msg: any) {
    this.options.onResize && this.options.onResize(msg);
  }

  protected onCloseRequest(msg: any) {
    super.onCloseRequest(msg);
    this.options.onClose && this.options.onClose();
  }
}
