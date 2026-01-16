export interface LineHierarchy {
  id: string;
  name: string;
  status: string;
  factoryName: string;
  cells: CellWithControllers[];
}

export interface CellWithControllers {
  id: string;
  name: string;
  status: string;
  lineId: string;
  controllers: ControllerDetail[];
}

export interface ControllerDetail {
  id: string;
  name: string;
  model?: string;
  application?: string;
  ipAddress: string;
  status: string;
  location?: string;
  cellId?: string;
}
