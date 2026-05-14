declare function attachDataValues(element: HTMLElement, data: {
    [key: string]: string | undefined;
    id: string;
    value: string;
}, dataAttributes: string[]): HTMLElement;
declare function setInnerContent(element: HTMLElement, value: HTMLElement | string | null): void;
declare function getMentionCharIndex(text: string, mentionDenotationChars: string[], isolateChar: boolean, allowInlineMentionChar: boolean): {
    mentionChar: string | null;
    mentionCharIndex: number;
};
declare function hasValidChars(text: string, allowedChars: RegExp): boolean;
declare function hasValidMentionCharIndex(mentionCharIndex: number, text: string, isolateChar: boolean, textPrefix: string): boolean;
export { attachDataValues, getMentionCharIndex, hasValidChars, hasValidMentionCharIndex, setInnerContent, };
//# sourceMappingURL=index.d.ts.map