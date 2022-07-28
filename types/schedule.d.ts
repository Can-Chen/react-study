declare namespace Schedule {
  type Heap = Array<INode>;
  type INode = {
    id: number;
    sortIndex: number;
    startTime: number;
    expirationTime: number;
    priorityLevel: PriorityLevel;
    callback: () => void
  };
  type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5;
}