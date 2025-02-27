package org.apereo.cas.ticket.refreshtoken;

import org.apereo.cas.authentication.Authentication;
import org.apereo.cas.authentication.principal.Service;
import org.apereo.cas.configuration.support.Beans;
import org.apereo.cas.services.ServicesManager;
import org.apereo.cas.support.oauth.OAuth20GrantTypes;
import org.apereo.cas.support.oauth.OAuth20ResponseTypes;
import org.apereo.cas.support.oauth.util.OAuth20Utils;
import org.apereo.cas.ticket.ExpirationPolicy;
import org.apereo.cas.ticket.ExpirationPolicyBuilder;
import org.apereo.cas.ticket.Ticket;
import org.apereo.cas.ticket.TicketGrantingTicket;
import org.apereo.cas.ticket.UniqueTicketIdGenerator;
import org.apereo.cas.util.DefaultUniqueTicketIdGenerator;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.apache.commons.lang3.StringUtils;

import java.util.Collection;
import java.util.Map;

/**
 * Default OAuth refresh token factory.
 *
 * @author Jerome Leleu
 * @since 5.0.0
 */
@RequiredArgsConstructor
public class OAuth20DefaultRefreshTokenFactory implements OAuth20RefreshTokenFactory {

    /**
     * Default instance for the ticket id generator.
     */
    protected final UniqueTicketIdGenerator refreshTokenIdGenerator;

    @Getter
    protected final ExpirationPolicyBuilder<OAuth20RefreshToken> expirationPolicyBuilder;

    /**
     * Services manager.
     */
    protected final ServicesManager servicesManager;

    public OAuth20DefaultRefreshTokenFactory(final ExpirationPolicyBuilder<OAuth20RefreshToken> expirationPolicyBuilder,
                                             final ServicesManager servicesManager) {
        this(new DefaultUniqueTicketIdGenerator(), expirationPolicyBuilder, servicesManager);
    }

    @Override
    public OAuth20RefreshToken create(final Service service,
                                      final Authentication authentication,
                                      final TicketGrantingTicket ticketGrantingTicket,
                                      final Collection<String> scopes,
                                      final String clientId,
                                      final String accessToken,
                                      final Map<String, Map<String, Object>> requestClaims,
                                      final OAuth20ResponseTypes responseType,
                                      final OAuth20GrantTypes grantType) throws Throwable {
        val codeId = this.refreshTokenIdGenerator.getNewTicketId(OAuth20RefreshToken.PREFIX);
        val expirationPolicyToUse = determineExpirationPolicyForService(clientId);
        val rt = new OAuth20DefaultRefreshToken(codeId, service, authentication,
            expirationPolicyToUse, ticketGrantingTicket,
            scopes, clientId, accessToken, requestClaims, responseType, grantType);

        if (ticketGrantingTicket != null) {
            ticketGrantingTicket.getDescendantTickets().add(rt.getId());
        }
        return rt;
    }

    private ExpirationPolicy determineExpirationPolicyForService(final String clientId) {
        val registeredService = OAuth20Utils.getRegisteredOAuthServiceByClientId(this.servicesManager, clientId);
        if (registeredService != null && registeredService.getRefreshTokenExpirationPolicy() != null) {
            val policy = registeredService.getRefreshTokenExpirationPolicy();
            val timeToKill = policy.getTimeToKill();
            if (StringUtils.isNotBlank(timeToKill)) {
                return new OAuth20RefreshTokenExpirationPolicy(Beans.newDuration(timeToKill).getSeconds());
            }
        }
        return this.expirationPolicyBuilder.buildTicketExpirationPolicy();
    }

    @Override
    public Class<? extends Ticket> getTicketType() {
        return OAuth20RefreshToken.class;
    }
}
