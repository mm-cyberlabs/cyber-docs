package com.mmcyberlabs.cyberdocs.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DebeziumConfig {

    @Value("${debezium.connector.name}")
    private String connectorName;

    @Value("${debezium.connector.database.hostname}")
    private String hostname;

    @Value("${debezium.connector.database.port}")
    private String port;

    @Value("${debezium.connector.database.user}")
    private String user;

    @Value("${debezium.connector.database.password}")
    private String password;

    @Value("${debezium.connector.database.dbname}")
    private String database;

    @Value("${debezium.connector.slot.name}")
    private String slotName;

    @Value("${debezium.connector.table.include.list}")
    private String tableIncludeList;

    /**
     * Creates Debezium configuration for PostgreSQL connector.
     *
     * @return Configuration object with all necessary settings
     */
    @Bean
    public io.debezium.config.Configuration debeziumConfiguration() {
        return io.debezium.config.Configuration.create()
                .with("name", connectorName)
                .with("connector.class", "io.debezium.connector.postgresql.PostgresConnector")
                .with("offset.storage", "org.apache.kafka.connect.storage.FileOffsetBackingStore")
                .with("offset.storage.file.filename", "/tmp/offsets.dat")
                .with("offset.flush.interval.ms", "60000")
                .with("database.hostname", hostname)
                .with("database.port", port)
                .with("database.user", user)
                .with("database.password", password)
                .with("database.dbname", database)
                .with("database.server.name", connectorName)
                .with("slot.name", slotName)
                .with("plugin.name", "pgoutput")
                .with("table.include.list", tableIncludeList)
                .with("publication.autocreate.mode", "filtered")
                .build();
    }
}
