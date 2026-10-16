export type InventoryScenario = {
  surface: "page" | "references" | "entries" | "timeline" | "preview";
  blocks: number;
};
export type MountResult = {
  milliseconds: number;
  editors: number;
  renderedBlocks: number;
  documentBlocks: number;
};
declare global {
  interface Window {
    editorInventory: {
      mount(scenario: InventoryScenario): Promise<MountResult>;
      samples: number[];
      transactions: number;
      errors: string[];
    };
  }
}
