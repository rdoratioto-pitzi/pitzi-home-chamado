import Quill from 'quill';
import { MentionBlot } from './blots/mention.mjs';
import { Mention } from './mention.mjs';

Quill.register({ "blots/mention": MentionBlot, "modules/mention": Mention });

export { Mention as default };
//# sourceMappingURL=autoregister.mjs.map
