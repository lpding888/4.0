export namespace development {
    let client: string;
    namespace connection {
        let host: string;
        let port: number;
        let user: string;
        let password: string;
        let database: string;
        let charset: string;
    }
    namespace pool {
        let min: number;
        let max: number;
    }
    namespace migrations {
        let directory: string;
        let tableName: string;
    }
    namespace seeds {
        let directory_1: string;
        export { directory_1 as directory };
    }
}
export namespace test {
    let client_1: string;
    export { client_1 as client };
    export namespace connection_1 {
        let host_1: string;
        export { host_1 as host };
        let port_1: number;
        export { port_1 as port };
        let user_1: string;
        export { user_1 as user };
        let password_1: string;
        export { password_1 as password };
        let database_1: string;
        export { database_1 as database };
        let charset_1: string;
        export { charset_1 as charset };
    }
    export { connection_1 as connection };
    export namespace pool_1 {
        let min_1: number;
        export { min_1 as min };
        let max_1: number;
        export { max_1 as max };
    }
    export { pool_1 as pool };
    export namespace migrations_1 {
        let directory_2: string;
        export { directory_2 as directory };
        let tableName_1: string;
        export { tableName_1 as tableName };
    }
    export { migrations_1 as migrations };
    export namespace seeds_1 {
        let directory_3: string;
        export { directory_3 as directory };
    }
    export { seeds_1 as seeds };
}
export namespace production {
    let client_2: string;
    export { client_2 as client };
    export namespace connection_2 {
        let host_2: string;
        export { host_2 as host };
        let port_2: number;
        export { port_2 as port };
        let user_2: string;
        export { user_2 as user };
        let password_2: string;
        export { password_2 as password };
        let database_2: string;
        export { database_2 as database };
        let charset_2: string;
        export { charset_2 as charset };
    }
    export { connection_2 as connection };
    export namespace pool_2 {
        let min_2: number;
        export { min_2 as min };
        let max_2: number;
        export { max_2 as max };
    }
    export { pool_2 as pool };
    export namespace migrations_2 {
        let directory_4: string;
        export { directory_4 as directory };
        let tableName_2: string;
        export { tableName_2 as tableName };
    }
    export { migrations_2 as migrations };
}
//# sourceMappingURL=knexfile.d.ts.map