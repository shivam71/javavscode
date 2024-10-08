export type userDefinedLaunchOptionsType = {
    [key: string]: {
        value: any,
        optionToPass?: string | string[],
        encloseInvertedComma?: boolean
    }
};

export interface VSNetBeansAPI {
    version : string;
    apiVersion: string;
}
