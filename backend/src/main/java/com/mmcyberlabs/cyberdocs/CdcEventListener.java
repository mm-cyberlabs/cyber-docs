package com.mmcyberlabs.cyberdocs;

import com.mmcyberlabs.cyberdocs.events.AuthenticatorMetricEvent;
import com.mmcyberlabs.cyberdocs.events.OnlineUserEvent;
import io.debezium.config.Configuration;
import io.debezium.embedded.Connect;
import io.debezium.engine.DebeziumEngine;
import io.debezium.engine.RecordChangeEvent;
import io.debezium.engine.format.ChangeEventFormat;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.connect.data.Struct;
import org.apache.kafka.connect.source.SourceRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Listens to database changes using Debezium CDC.
 * Converts CDC events into MetricEvent objects.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CdcEventListener {

    private final Configuration debeziumConfig;
    private final MetricEventPublisher eventPublisher;
    private DebeziumEngine<RecordChangeEvent<SourceRecord>> debeziumEngine;

    /**
     * Initializes and starts the Debezium engine after bean construction.
     */
    @PostConstruct
    public void start() {
        Executor executor = Executors.newSingleThreadExecutor();

        debeziumEngine = DebeziumEngine.create(ChangeEventFormat.of(Connect.class))
                .using(debeziumConfig.asProperties())
                .notifying(this::handleChangeEvent)  // point to the dispatcher below
                .build();

        executor.execute(debeziumEngine);
        log.info("CDC Event Listener started successfully");
    }

    /**
     * Processes individual change events from Debezium.
     *
     * @param recordChangeEvent The CDC event containing database changes
     */
    private void handleChangeEvent(RecordChangeEvent<SourceRecord> recordChangeEvent) {
        SourceRecord sourceRecord = recordChangeEvent.record();

        if (sourceRecord.value() == null) {
            return;  // skip tombstone or delete-without-value cases
        }

        try {
            // Debezium wraps the payload as a Struct with "before", "after", "source", "op", etc.
            Struct valueStruct = (Struct) sourceRecord.value();
            Struct sourceStruct = valueStruct.getStruct("source");
            String tableName = sourceStruct.getString("table");  // gets table name, e.g. "user_metrics" or "user_online"

            switch (tableName) {
                case "user_metrics":
                    AuthenticatorMetricEvent metricEvent = convertToMetricEvent(sourceRecord);
                    eventPublisher.publishEvent(metricEvent);
                    log.debug("Published metric event: {}", metricEvent);
                    break;

                case "user_online":
                    OnlineUserEvent onlineEvent = convertToUserOnlineEvent(sourceRecord);
                    eventPublisher.publishEvent(onlineEvent);
                    log.debug("Published online event: {}", onlineEvent);
                    break;

                default:
                    log.warn("Received CDC event for unknown table: {}", tableName);
            }
        } catch (Exception e) {
            log.error("Error processing CDC event", e);
        }
    }

    /**
     * Converts Debezium SourceRecord to MetricEvent.
     *
     * @param record The source record from Debezium
     * @return Converted MetricEvent
     */
    private AuthenticatorMetricEvent convertToMetricEvent(SourceRecord record) {
        Struct value = (Struct) record.value();
        Struct after = value.getStruct("after");
        String operation = value.getString("op");

        return AuthenticatorMetricEvent.builder()
                .id(after.getInt64("id"))
                .authenticator(after.getString("authenticator"))
                .signInUserCount(after.getInt32("sign_in_user_count"))
                .signOffUserCount(after.getInt32("sign_off_user_count"))
                .operation(operation)
                .sourceOfRecord(record.topic())
                .instant(Instant.now())
                .build();
    }


    /**
     * New: Converts Debezium SourceRecord from `user_online` into UserOnlineMetricEvent.
     * Adjust field names/types to match your `user_online` schema.
     */
    private OnlineUserEvent convertToUserOnlineEvent(SourceRecord record) {
        Struct value = (Struct) record.value();
        Struct after = value.getStruct("after");
        String operation = value.getString("op");

        return OnlineUserEvent.builder()
                .id(after.getInt64("id"))
                .userUuid(after.getString("user_uuid"))
                .jti(after.getString("jti"))
                .onlineStartDatetime(Instant.parse(after.getString("online_start_datetime")))
                .tokenExpirationDatetime(Instant.parse(after.getString("token_expiration_datetime")))
                .renewalCount(after.getInt32("renewal_count"))
                .operation(operation)
                .sourceOfRecord(record.topic())
                .instant(Instant.now())
                .build();
    }

    /**
     * Stops the Debezium engine before bean destruction.
     */
    @PreDestroy
    public void stop() throws IOException {
        if (debeziumEngine != null) {
            debeziumEngine.close();
            log.info("CDC Event Listener stopped");
        }
    }
}
