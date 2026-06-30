export function nestProcessFlowData(units, flows, steps, stepDocs) {
    const docsByStep = stepDocs.reduce((map, row) => {
        const list = map.get(row.step_id) || [];
        list.push(row);
        map.set(row.step_id, list);
        return map;
    }, new Map());

    const stepsByFlow = steps.reduce((map, row) => {
        const list = map.get(row.flow_id) || [];
        list.push({
            ...row,
            documents: (docsByStep.get(row.id) || []).sort((a, b) => a.sort_order - b.sort_order),
        });
        map.set(row.flow_id, list);
        return map;
    }, new Map());

    const flowsByUnit = flows.reduce((map, row) => {
        const list = map.get(row.unit_id) || [];
        list.push({
            ...row,
            steps: (stepsByFlow.get(row.id) || []).sort((a, b) => a.sort_order - b.sort_order),
        });
        map.set(row.unit_id, list);
        return map;
    }, new Map());

    return units
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((unit) => ({
            ...unit,
            flows: (flowsByUnit.get(unit.id) || []).sort((a, b) => a.sort_order - b.sort_order),
        }));
}
