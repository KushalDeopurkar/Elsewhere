/** Runs before paint (inline in the layout) so a graded session never flashes the default colours. Key matches lib/grade.ts. */
export const GRADE_BOOT = `try{var g=sessionStorage.getItem("ee.grade.v1");if(g)document.documentElement.dataset.grade=g}catch(e){}`;
