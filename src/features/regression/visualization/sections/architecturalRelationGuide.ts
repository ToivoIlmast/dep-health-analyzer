export function architecturalRelationGuide(): string {
    return `
        <h2>Architectural relation guide</h2>
            
        <table>
            <thead>
                <tr>
                    <th>Relation</th>
                    <th>Meaning</th>
                </tr>
            </thead>
    
            <tbody>
                <tr>
                    <td class="sibling">sibling</td>
                    <td>
                        Modules located in the same parent directory.
                    </td>
                </tr>
    
                <tr>
                    <td class="internal">internal</td>
                    <td>
                        Dependency inside a shared structural area.
                    </td>
                </tr>
    
                <tr>
                    <td class="deep-internal">deep-internal</td>
                    <td>
                        Dependency reaches deeply into nested internal structure.
                    </td>
                </tr>
    
                <tr>
                    <td class="cross-boundary">cross-boundary</td>
                    <td>
                        Dependency crosses structural area boundary.
                    </td>
                </tr>
            </tbody>
        </table>
    `;
}
