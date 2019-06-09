import { SearchQuery, SearchResulList } from '../search/interfaces';

export interface API {
    search(query: SearchQuery): Promise<SearchResulList>;
    test(): Promise<void>;
    getServicesAndOperations(): { [key: string]: string[] };
    updateServicesAndOperationsCache(): Promise<{ [key: string]: string[] }>;
}
