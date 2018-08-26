export const {
    export1,
    noExport1: { export2 },
    noExport2: [export3, { export4 }]
} = someFunc();
