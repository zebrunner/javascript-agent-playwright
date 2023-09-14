export type TcmType = 'TEST_RAIL' | 'ZEPHYR' | 'XRAY' | 'ZEBRUNNER';

export interface TestCase {

    tcmType: TcmType;
    testCaseId: string;
    resultStatus?: string;

}

export interface UpsertTestTestCases {

    items: TestCase[];

}
