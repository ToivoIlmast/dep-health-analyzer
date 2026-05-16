/* const graph = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set(['A', 'D', 'E'])],
        ['D', new Set(['B'])],
        ['E', new Set(['F'])],
        ['F', new Set([])],
        ['G', new Set(['H'])],
        ['H', new Set(['I'])],
        ['I', new Set(['G'])],
        ['J', new Set([])],
    ]); */
/* const graph = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C', 'E'])],
        ['C', new Set(['A', 'D'])],
        ['D', new Set(['E'])],
        ['E', new Set(['F'])],
        ['F', new Set(['D', 'G'])],
        ['G', new Set(['H'])],
        ['H', new Set(['I'])],
        ['I', new Set(['G', 'J'])],
        ['J', new Set([])],
    ]); */
/* const graph = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C', 'E'])],
        ['C', new Set(['A', 'D'])],

        ['D', new Set(['E'])],
        ['E', new Set(['F', 'H'])],
        ['F', new Set(['D', 'G'])],

        ['G', new Set(['H'])],
        ['H', new Set(['I'])],
        ['I', new Set(['G', 'J'])],

        ['J', new Set(['K'])],
        ['K', new Set(['L'])],
        ['L', new Set(['J', 'M'])],

        ['M', new Set([])],
    ]); */

/* const graph1 = new Map<string, Set<string>>([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set(['A', 'D', 'E'])],
        ['D', new Set(['B'])],
        ['E', new Set(['F'])],
        ['F', new Set([])],
        ['G', new Set(['H'])],
        ['H', new Set(['I'])],
        ['I', new Set(['G'])],
        ['J', new Set([])],
    ]); */

/* const graph1 = new Map<string, Set<string>>();

    // Create 250 nodes
    for (let i = 1; i <= 250; i++) {
        graph1.set(`Module${i}`, new Set());
    }

    // Linear chains
    for (let i = 1; i < 250; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Large hidden SCC #1
    graph1.get('Module34')?.add('Module12');
    graph1.get('Module12')?.add('Module27');
    graph1.get('Module27')?.add('Module34');

    // Hidden SCC #2
    graph1.get('Module88')?.add('Module91');
    graph1.get('Module91')?.add('Module95');
    graph1.get('Module95')?.add('Module88');

    // Long-distance cycle
    graph1.get('Module140')?.add('Module172');
    graph1.get('Module172')?.add('Module199');
    graph1.get('Module199')?.add('Module140');

    // Architecture decay cluster
    graph1.get('Module210')?.add('Module211');
    graph1.get('Module211')?.add('Module212');
    graph1.get('Module212')?.add('Module213');
    graph1.get('Module213')?.add('Module214');
    graph1.get('Module214')?.add('Module210');

    // Random cross-dependencies
    graph1.get('Module15')?.add('Module180');
    graph1.get('Module45')?.add('Module132');
    graph1.get('Module78')?.add('Module34');
    graph1.get('Module101')?.add('Module56');
    graph1.get('Module160')?.add('Module42');
    graph1.get('Module220')?.add('Module70');

    // Fake "god module"
    for (let i = 1; i <= 40; i++) {
        graph1.get('Module125')?.add(`Module${i}`);
    }

    // Shared utility dependency
    for (let i = 130; i <= 180; i++) {
        graph1.get(`Module${i}`)?.add('Module5');
    }
    
    // Mini SCCs scattered
    graph1.get('Module50')?.add('Module51');
    graph1.get('Module51')?.add('Module50');

    graph1.get('Module73')?.add('Module74');
    graph1.get('Module74')?.add('Module75');
    graph1.get('Module75')?.add('Module73');

    graph1.get('Module166')?.add('Module167');
    graph1.get('Module167')?.add('Module166');

    graph1.get('Module240')?.add('Module241');
    graph1.get('Module241')?.add('Module242');
    graph1.get('Module242')?.add('Module243');
    graph1.get('Module243')?.add('Module240');
    */

/* const graph1 = new Map<string, Set<string>>();

    // Create 250 modules
    for (let i = 1; i <= 250; i++) {
        graph1.set(`Module${i}`, new Set());
    }

    // Main linear flow
    for (let i = 1; i < 250; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Small isolated SCCs scattered around

    // SCC #1
    graph1.get('Module12')?.add('Module15');
    graph1.get('Module15')?.add('Module18');
    graph1.get('Module18')?.add('Module12');

    // SCC #2
    graph1.get('Module33')?.add('Module34');
    graph1.get('Module34')?.add('Module33');

    // SCC #3
    graph1.get('Module47')?.add('Module52');
    graph1.get('Module52')?.add('Module55');
    graph1.get('Module55')?.add('Module47');

    // SCC #4
    graph1.get('Module70')?.add('Module71');
    graph1.get('Module71')?.add('Module72');
    graph1.get('Module72')?.add('Module70');

    // SCC #5
    graph1.get('Module88')?.add('Module90');
    graph1.get('Module90')?.add('Module88');

    // SCC #6
    graph1.get('Module101')?.add('Module103');
    graph1.get('Module103')?.add('Module105');
    graph1.get('Module105')?.add('Module101');

    // SCC #7
    graph1.get('Module122')?.add('Module123');
    graph1.get('Module123')?.add('Module122');

    // SCC #8
    graph1.get('Module140')?.add('Module145');
    graph1.get('Module145')?.add('Module148');
    graph1.get('Module148')?.add('Module140');

    // SCC #9
    graph1.get('Module166')?.add('Module167');
    graph1.get('Module167')?.add('Module168');
    graph1.get('Module168')?.add('Module166');

    // SCC #10
    graph1.get('Module190')?.add('Module192');
    graph1.get('Module192')?.add('Module194');
    graph1.get('Module194')?.add('Module190');

    // SCC #11
    graph1.get('Module220')?.add('Module221');
    graph1.get('Module221')?.add('Module220');

    // SCC #12
    graph1.get('Module235')?.add('Module240');
    graph1.get('Module240')?.add('Module244');
    graph1.get('Module244')?.add('Module235');

    // Random cross-links (non-cyclic)
    graph1.get('Module10')?.add('Module80');
    graph1.get('Module25')?.add('Module140');
    graph1.get('Module61')?.add('Module200');
    graph1.get('Module99')?.add('Module170');
    graph1.get('Module130')?.add('Module210');
    graph1.get('Module175')?.add('Module240');
    graph1.get('Module205')?.add('Module50');

    // Utility-style shared dependencies
    for (let i = 150; i <= 180; i++) {
        graph1.get(`Module${i}`)?.add('Module5');
    }

    for (let i = 181; i <= 210; i++) {
        graph1.get(`Module${i}`)?.add('Module42');
    }
    */

/*
    const graph1 = new Map<string, Set<string>>();

    // Create 100 nodes
    for (let i = 1; i <= 100; i++) {
        graph1.set(`Module${i}`, new Set());
    }


    // Region 1
    for (let i = 1; i < 20; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Region 2
    for (let i = 21; i < 40; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Region 3
    for (let i = 41; i < 60; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Region 4
    for (let i = 61; i < 80; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    // Region 5
    for (let i = 81; i < 100; i++) {
        graph1.get(`Module${i}`)?.add(`Module${i + 1}`);
    }

    graph1.get('Module5')?.add('Module8');
    graph1.get('Module8')?.add('Module11');
    graph1.get('Module11')?.add('Module5');


    graph1.get('Module25')?.add('Module27');
    graph1.get('Module27')?.add('Module30');
    graph1.get('Module30')?.add('Module33');
    graph1.get('Module33')?.add('Module25');

    graph1.get('Module45')?.add('Module47');
    graph1.get('Module47')?.add('Module49');
    graph1.get('Module49')?.add('Module51');
    graph1.get('Module51')?.add('Module53');
    graph1.get('Module53')?.add('Module45');

    graph1.get('Module66')?.add('Module68');
    graph1.get('Module68')?.add('Module70');
    graph1.get('Module70')?.add('Module66');

    graph1.get('Module84')?.add('Module86');
    graph1.get('Module86')?.add('Module88');
    graph1.get('Module88')?.add('Module90');
    graph1.get('Module90')?.add('Module92');
    graph1.get('Module92')?.add('Module94');
    graph1.get('Module94')?.add('Module84');

    graph1.get('Module12')?.add('Module45');
    graph1.get('Module18')?.add('Module65');

    graph1.get('Module35')?.add('Module85');

    graph1.get('Module58')?.add('Module22');

    graph1.get('Module72')?.add('Module10');

    graph1.get('Module95')?.add('Module40');
    */
