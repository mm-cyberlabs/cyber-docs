package com.mmcyberlabs.cyberdocs;

import com.mmcyberlabs.cyberdocs.events.AuthenticatorMetricEvent;
import com.mmcyberlabs.cyberdocs.model.AuthenticatorMetricResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Aggregates metric events into time-windowed summaries.
 * Provides statistical calculations for metric streams.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricAggregationService {

    /**
     * Aggregates metric events within a time window.
     *
     * @param events         Flux of metric events
     * @param windowDuration Duration of the aggregation window
     * @return Flux of aggregated metrics
     */
    public Flux<AuthenticatorMetricResponse> aggregateByWindow(Flux<AuthenticatorMetricEvent> events, Duration windowDuration) {
        return events
                .window(windowDuration)
                .flatMap(window -> aggregateWindow(window, windowDuration));
    }

    /**
     * Aggregates a single window of events.
     *
     * @param window   Flux of events in the window
     * @param duration Window duration
     * @return Mono of aggregated result
     */
    private Mono<AuthenticatorMetricResponse> aggregateWindow(Flux<AuthenticatorMetricEvent> window, Duration duration) {
        Instant windowStart = Instant.now();
        Instant windowEnd = windowStart.plus(duration);

        return window
                .collectList()
                .map(events -> calculateAggregate(events, windowStart, windowEnd))
                .filter(aggregate -> aggregate.getSignInUserCount() > 0);
    }

    /**
     * Calculates aggregate statistics for a list of events.
     *
     * @param events List of metric events
     * @param start  Window start time
     * @param end    Window end time
     * @return Calculated MetricAggregate
     */
    private AuthenticatorMetricResponse calculateAggregate(List<AuthenticatorMetricEvent> events, Instant start, Instant end) {
        if (events.isEmpty()) {
            return AuthenticatorMetricResponse.builder()
                    .signInUserCount(0)
                    .signOffUserCount(0)
                    .build();
        }

        double sum = events.stream().mapToDouble(AuthenticatorMetricEvent::getSignInUserCount).sum();
        double avg = sum / events.size();

        return AuthenticatorMetricResponse.builder()
                .signInUserCount().build();
    }
}
