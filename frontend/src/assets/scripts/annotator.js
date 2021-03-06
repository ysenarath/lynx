import $ from 'jquery';

/**
 * Annotator Object
 *
 * @param id: ID
 * @param text: Text
 * @returns {{getSelection: (function(): {}), html: (function(): string), setAnnotations: setAnnotations}}
 * @constructor
 */
export default class Annotator {
    constructor(id, text, options = {}, verbose = false) {
        this.lookout = document.getElementById(id);
        this.text = text;
        this.options = options;
        this.verbose = verbose;
        this.annotations = {};
        this.selection = {};
        this.events = {};
    }

    /**
     * Visualize Text and Annotations in the Element
     *
     * @returns {boolean}
     */
    update() {
        let temp_annotations = [];
        for (let key in this.annotations) {
            temp_annotations.push(this.annotations[key]);
        }
        this.lookout.innerHTML = '';
        temp_annotations.sort((a, b) => {
            return a.span.start - b.span.start
        });
        let tokenSeparator = /(?=\s+)/;
        let html = '';
        // Extract HTML with <span/> Tags for Annotations
        let lastIdx = 0;
        let error = false;
        for (let i = 0; i < temp_annotations.length; i++) {
            let item = temp_annotations[i];
            if (item.span.start < lastIdx) {
                error = true;
                break;
            }
            let tokens = this.text.substr(lastIdx, item.span.start - lastIdx).split(tokenSeparator);
            for (let j = 0; j < tokens.length; j++) {
                html += '<span class="annotation-text">' + tokens[j] + '</span>';
            }
            let options_html = '';
            let has_selection = false;
            for (let j = 0; j < this.options.length; j++) {
                let is_selected = this.options[j].value == item.label;
                if (is_selected) {
                    has_selection = true;
                }
                options_html += '<option value="' + this.options[j].value + '"' + (is_selected ? 'selected' : '')
                    + '>' + this.options[j].label + '</option>'
            }
            if (!has_selection) {
                options_html = '<option selected>Select Option</option>' + options_html
            }
            html +=
                '<div class="annotation-span" style="border-color:' + item.color + '">' +
                '<div class="annotation-text">' + this.text.substr(item.span.start, item.span.length) + '</div>' +
                '<div class="annotation-label" style="background: #495057">' +
                '<div class="input-group input-group-sm">' +
                '<select class="custom-select" data-id="' + item.id + '" style="color: #fff">' +
                options_html +
                '</select>' +
                '<div class="input-group-append">' +
                '<button class="btn" type="button" data-id="' + item.id + '">&times;</button>' +
                '</div>' +
                '</div>' +
                '</div></div>';
            lastIdx = item.span.start + item.span.length;
        }
        // Annotation Loading Failed due to Invalid Annotation.
        let tokens;
        if (error) {
            tokens = this.text.split(tokenSeparator);
        } else {
            tokens = this.text.substr(lastIdx).split(tokenSeparator);
        }
        for (let j = 0; j < tokens.length; j++) {
            html += '<span class="annotation-text">' + tokens[j] + '</span>'
        }
        // HTML build success
        this.lookout.innerHTML = html;
        return !error;
    }

    /**
     * Annotate Function - Creates an annotation given the label and color.
     *
     * @param item Annotation information for the selection
     */
    _annotate_selection(item) {
        let backup = {};
        Object.assign(backup, this.annotations);
        if ((typeof this.selection.span !== 'undefined') && this.selection.span !== null &&
            (this.selection.span.end !== this.selection.span.start)) {
            // add selected region as new annotation
            this.annotations[item.id] = {
                id: item.id,
                label: item.label,
                span: {
                    start: this.selection.span.start,
                    length: this.selection.span.end - this.selection.span.start
                }
            };
            // update annotator with new annotation
            let status = this.update();
            // rollback on error
            if (!status) {
                this.annotations = backup;
                this.update();
                throw 'Invalid Selection for Annotation. ' +
                'Only non-overlapping Annotations are Allowed. ' +
                'Check Existing Annotations and Try Again.'
            }
        } else {
            throw 'Invalid Selection for Annotation. Selection should be non-empty.'
        }
    }

    initialize() {
        let lookout = this.lookout;
        let events = this.events;

        document.onmouseup = (e) => {
            // todo: fix only update for lookout
            if (e !== null && typeof e.target !== 'undefined' && e.target !== null &&
                (e.target.nodeName === 'SELECT' || e.target.nodeName === 'BUTTON'))
                return;
            try {
                // 0 is reserved annotation
                this._annotate_selection({id: 0, label: null, color: 'gray'});
            } catch (e) {
                delete this.annotations[0];
                this.update();
                if (this.verbose)
                    console.error(e)
            }
        };

        document.onselectionchange = () => {
            let _selection = null;
            if (document.getSelection().rangeCount > 0) {
                const range = document.getSelection().getRangeAt(0);
                let startNode = range.startContainer;
                let startOffset = range.startOffset;
                if (startNode !== null && startNode.parentNode !== this.lookout) {
                    startNode = startNode.parentNode;
                }
                let endNode = range.endContainer;
                let endOffset = range.endOffset;
                if (endNode !== null && endNode.parentNode !== this.lookout) {
                    endNode = endNode.parentNode;
                }
                if (startNode.parentNode === this.lookout && endNode.parentNode === this.lookout) {
                    let counter = 0;
                    for (let i = 0; i < this.lookout.childNodes.length; i++) {
                        let node = this.lookout.childNodes[i];
                        if (node === startNode) {
                            startOffset += counter;
                        }
                        if (node === endNode) {
                            endOffset += counter;
                            break;
                        }
                        if (node.childNodes.length > 1) {
                            counter += node.childNodes[0].textContent.length;
                        } else {
                            counter += node.textContent.length;
                        }
                    }
                    _selection = {start: startOffset, end: endOffset};
                }
            }
            if (this.selection.span !== null || _selection !== null) {
                this.selection.span = _selection;
                // notify on selection change observers here
            }
        };

        // Change Annotation Type Selection
        $(document).on('change', '.annotation-span select', (el) => {
            try {
                if (el.target.parentNode.parentNode.parentNode.parentNode === lookout) {
                    let id = el.target.getAttribute('data-id');
                    let value = el.target.value;
                    events['update'](this.annotations[id], value);
                }
            } catch (e) {
                // ignore event
            }
        });

        // Delete Annotation Button
        $(document).on('click', '.annotation-span button', (el) => {
            try {
                if (el.target.parentNode.parentNode.parentNode.parentNode.parentNode === lookout) {
                    let id = el.target.getAttribute('data-id');
                    events['delete'](this.annotations[id]);
                }
            } catch (e) {
                // ignore event
            }
        });

        this.update();
    }

    setAnnotations(items) {
        this.annotations = {};
        items.forEach((item) => {
            this.annotations[item.id] = item;
        });
        this.update();
    }

    addEventListener(condition, func) {
        this.events[condition] = func;
    }
}
