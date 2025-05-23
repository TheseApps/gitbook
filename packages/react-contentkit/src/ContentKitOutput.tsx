import type { ContentKitRenderOutput } from '@gitbook/api';

import { Element } from './Element';
import type { ContentKitServerContext } from './types';

/**
 * Generic component to render a ContentKit output.
 * The component can be used both as a client and server one.
 */
export function ContentKitOutput(props: {
    context: ContentKitServerContext;
    output: ContentKitRenderOutput;
}) {
    const { output, context } = props;

    if (output.type === 'complete') {
        return null;
    }

    return (
        <>
            {process.env.NODE_ENV === 'development' ? (
                <pre style={{ display: 'none' }}>{JSON.stringify(props.output, null, 2)}</pre>
            ) : null}
            <Element element={output.element} context={context} state={output.state} />
        </>
    );
}
