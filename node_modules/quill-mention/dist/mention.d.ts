import Quill from "quill";
import type { Delta, EmitterSource, Range } from "quill/core";
declare const Module: typeof import("quill").Module;
export interface MentionOption {
    /**
     * Specifies which characters will cause the mention autocomplete to open
     * @default ["@"]
     */
    mentionDenotationChars: string[];
    /**
     * Whether to show the used denotation character in the mention item or not
     * @default true
     */
    showDenotationChar: boolean;
    /**
     * Allowed characters in search term triggering a search request using regular expressions. Can be a function that takes the denotationChar and returns a regex.
     * @default /^[a-zA-Z0-9_]*$/
     */
    allowedChars: RegExp | ((char: string) => RegExp);
    /**
     * Minimum number of characters after the @ symbol triggering a search request
     * @default 0
     */
    minChars: number;
    /**
     * Maximum number of characters after the @ symbol triggering a search request
     * @default 31
     */
    maxChars: number;
    /**
     * Additional top offset of the mention container position
     * @default 2
     */
    offsetTop: number;
    /**
     * Additional left offset of the mention container position
     * @default 0
     */
    offsetLeft: number;
    /**
     * Whether or not the denotation character(s) should be isolated. For example, to avoid mentioning in an email.
     * @default false
     */
    isolateCharacter: boolean;
    /**
     * Only works if isolateCharacter is set to true. Whether or not the denotation character(s) can appear inline of the mention text. For example, to allow mentioning an email with the @ symbol as the denotation character.
     * @default false
     */
    allowInlineMentionChar: boolean;
    /**
     * When set to true, the mentions menu will be rendered above or below the quill container. Otherwise, the mentions menu will track the denotation character(s);
     * @default false
     */
    fixMentionsToQuill: boolean;
    /**
     * Options are 'normal' and 'fixed'. When 'fixed', the menu will be appended to the body and use fixed positioning. Use this if the menu is clipped by a parent element that's using `overflow:hidden
     * @default "normal"
     */
    positioningStrategy: "normal" | "fixed";
    /**
     * Options are 'bottom' and 'top'. Determines what the default orientation of the menu will be. Quill-mention will attempt to render the menu either above or below the editor. If 'top' is provided as a value, and there is not enough space above the editor, the menu will be rendered below. Vice versa, if there is not enough space below the editor, and 'bottom' is provided as a value (or no value is provided at all), the menu will be rendered above the editor.
     * @default "bottom"
     */
    defaultMenuOrientation: "top" | "bottom";
    /**
     * The name of the Quill Blot to be used for inserted mentions. A default implementation is provided named 'mention', which may be overridden with a custom blot.
     * @default "mention"
     */
    blotName: string;
    /**
     * A list of data values you wish to be passed from your list data to the html node. (id, value, denotationChar, link, target are included by default).
     * @default ["id", "value", "denotationChar", "link", "target", "disabled"]
     */
    dataAttributes: string[];
    /**
     * Link target for mentions with a link
     * @default "_blank"
     */
    linkTarget: string;
    /**
     * Style class to be used for list items (may be null)
     * @default "ql-mention-list-item"
     */
    listItemClass: string;
    /**
     * Style class to be used for the mention list container (may be null)
     * @default "ql-mention-list-container"
     */
    mentionContainerClass: string;
    /**
     * Style class to be used for the mention list (may be null)
     * @default "ql-mention-list"
     */
    mentionListClass: string;
    /**
     * Whether or not insert 1 space after mention block in text
     * @default true
     */
    spaceAfterInsert: boolean;
    /**
     * An array of keyboard key codes that will trigger the select action for the mention dropdown. Default is ENTER key. See this reference for a list of numbers for each keyboard key.
     * @default [13]
     */
    selectKeys: (string | number | string)[];
    /**
     * Required callback function to handle the search term and connect it to a data source for matches. The data source can be a local source or an AJAX request.
     * The callback should call renderList(matches, searchTerm); with matches of JSON Objects in an array to show the result for the user. The JSON Objects should have id and value but can also have other values to be used in renderItem for custom display.
     * @param textAfter
     * @param render
     * @param mentionChar
     * @returns
     */
    source: (textAfter: string, renderList: (matches: {
        id: string;
        value: string;
        [key: string]: string | undefined;
    }[], searchTerm: string) => void, mentionChar: string) => void;
    /**
     * Callback when mention dropdown is open.
     * @returns
     */
    onOpen: () => boolean;
    /**
     * Callback before the DOM of mention dropdown is removed.
     * @returns
     */
    onBeforeClose: () => boolean;
    /**
     * Callback when mention dropdown is closed.
     * @returns
     */
    onClose: () => boolean;
    /**
     * A function that gives you control over how matches from source are displayed. You can use this function to highlight the search term or change the design with custom HTML. This function will need to return either a string possibly containing unsanitized user content, or a class implementing the Node interface which will be treated as a sanitized DOM node.
     * @param item
     * @param searchTerm
     * @returns
     */
    renderItem: (item: {
        id: string;
        value: string;
        [key: string]: unknown;
    }, searchTerm: string) => string | HTMLElement;
    /**
     * A function that returns the HTML for a loading message during async calls from source. The function will need to return either a string possibly containing unsanitized user content, or a class implementing the Node interface which will be treated as a sanitized DOM node. The default functions returns null to prevent a loading message.
     * @returns
     */
    renderLoading: () => string | HTMLElement | null;
    /**
     * Callback for a selected item. When overriding this method, insertItem should be used to insert item to the editor. This makes async requests possible.
     * @param item
     * @param insertItem
     */
    onSelect: (item: DOMStringMap, insertItem: (data: Record<string, unknown>, programmaticInsert?: boolean, overriddenOptions?: object) => void) => void;
}
export declare class Mention extends Module<MentionOption> {
    static DEFAULTS: MentionOption;
    private isOpen;
    private itemIndex;
    private mentionCharPos?;
    private cursorPos?;
    private values;
    private suspendMouseEnter;
    /**
     * this token is an object that may contains one key "abandoned", set to
     * true when the previous source call should be ignored in favor or a
     * more recent execution. This token will be undefined unless a source call
     * is in progress.
     */
    private existingSourceExecutionToken?;
    private mentionContainer;
    private mentionList;
    constructor(quill: Quill, options?: Partial<MentionOption>);
    selectHandler(): boolean;
    escapeHandler(): boolean;
    upHandler(): boolean;
    downHandler(): boolean;
    showMentionList(): void;
    hideMentionList(): void;
    highlightItem(scrollItemInView?: boolean): void;
    onContainerMouseMove(): void;
    selectItem(): void;
    insertItem(data: {
        [key: string]: unknown;
    } | null, programmaticInsert: boolean, overriddenOptions?: {}): Delta | undefined;
    onItemMouseEnter(e: Event): void;
    onDisabledItemMouseEnter(): void;
    onItemClick(e: Event): void;
    onItemMouseDown(e: Event): void;
    renderLoading(): void;
    removeLoading(): void;
    renderList(mentionChar: string, data: {
        id: string;
        value: string;
        [key: string]: string | undefined;
    }[], searchTerm: string): void;
    nextItem(): void;
    prevItem(): void;
    containerBottomIsNotVisible(topPos: number, containerPos: DOMRect): boolean;
    containerRightIsNotVisible(leftPos: number, containerPos: DOMRect): boolean;
    setIsOpen(isOpen: boolean): void;
    setMentionContainerPosition(): void;
    setMentionContainerPosition_Normal(): void;
    setMentionContainerPosition_Fixed(): void;
    getTextBeforeCursor(): string;
    onSomethingChange(): void;
    getAllowedCharsRegex(denotationChar: string): RegExp;
    onTextChange(delta: Delta, oldContent: Delta, source: EmitterSource): void;
    onSelectionChange(range: Range | null): void;
    openMenu(denotationChar: string): void;
}
export {};
//# sourceMappingURL=mention.d.ts.map