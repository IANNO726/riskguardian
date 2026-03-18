import React, { useEffect } from 'react';

interface Props {
  riskScore: number;
}

const RiskAlarm: React.FC<Props> = ({ riskScore }) => {

  useEffect(() => {
    if (riskScore > 80) {
      const audio = new Audio(
        'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
      );
      audio.play();
    }
  }, [riskScore]);

  if (riskScore <= 80) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#ff0000',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: 8,
      fontWeight: 700,
      zIndex: 9999
    }}>
      âš  HIGH RISK ALERT
    </div>
  );
};

export default RiskAlarm;

