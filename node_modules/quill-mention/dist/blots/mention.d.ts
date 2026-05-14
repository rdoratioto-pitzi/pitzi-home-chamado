import type { ScrollBlot, EmbedBlot } from "parchment";
declare const Embed: typeof EmbedBlot;
declare class MentionEvent extends Event {
    value: object;
    event: Event;
    constructor(name: string, options: EventInit);
}
interface MentionBlotData {
    value: string;
    denotationChar: string;
}
declare function isMentionBlotData(data: unknown): data is MentionBlotData;
declare class MentionBlot extends Embed {
    static blotName: string;
    static tagName: string;
    static className: string;
    private hoverHandler?;
    private clickHandler?;
    private mounted;
    constructor(scroll: ScrollBlot, node: Node);
    static render?(data: MentionBlotData): HTMLElement;
    static create(data?: MentionBlotData): Node;
    static setDataValues(element: HTMLElement, data: MentionBlotData): HTMLElement;
    static value(domNode: HTMLElement): any;
    attach(): void;
    detach(): void;
    getClickHandler(): EventListener;
    getHoverHandler(): EventListener;
    private buildEvent;
}
export { MentionBlot, MentionBlotData, isMentionBlotData, MentionEvent };
//# sourceMappingURL=mention.d.ts.map