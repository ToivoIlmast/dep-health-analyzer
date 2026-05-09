import { scanProject } from './index';

async function main() {
    const result = await scanProject('./src');

    console.log('Scanned:', result.scannedFiles);
    console.log('Nodes:', result.graph.nodes.size);

    console.log('\nEdges:');

    for (const [from, deps] of result.graph.edges) {
        for (const to of deps) {
            console.log(`${from} -> ${to}`);
        }
    }
}

main().catch(console.error);
