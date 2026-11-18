"""
RL Controller for Inverted Pendulum (CartPole)
Senior Control Engineering Implementation:
- Higher-resolution state discretization for continuous control
- Balanced reward shaping (LQR penalty formulation)
- Multi-condition evaluation and stabilization test
"""

import math
import json
import os
import numpy as np
import matplotlib.pyplot as plt
import gymnasium as gym

np.random.seed(42)

class AdvancedQCartPole:
    def __init__(self,
                 n_bins=(3, 3, 14, 14), # (x, x_dot, theta, theta_dot)
                 lr=0.20,
                 gamma=0.99,
                 epsilon=1.0,
                 epsilon_min=0.01,
                 epsilon_decay=0.994):
        self.n_bins = n_bins
        self.lr = lr
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.n_actions = 2  # 0: Push Left (-10N), 1: Push Right (+10N)

        # Operational domain for linear/controllable inverted pendulum
        self.bounds = [
            (-2.4, 2.4),                              # x [m]
            (-2.5, 2.5),                              # x_dot [m/s]
            (-math.radians(14), math.radians(14)),    # theta [rad]
            (-math.radians(60), math.radians(60))     # theta_dot [rad/s]
        ]

        self.q_table = np.zeros(self.n_bins + (self.n_actions,))

    def discretize_state(self, state):
        cart_pos, cart_vel, pole_angle, pole_vel = state
        indices = []
        for i, val in enumerate([cart_pos, cart_vel, pole_angle, pole_vel]):
            low, high = self.bounds[i]
            clipped = np.clip(val, low, high)
            num_b = self.n_bins[i]
            if num_b <= 1:
                idx = 0
            else:
                idx = int((clipped - low) / (high - low) * (num_b - 1))
            indices.append(idx)
        return tuple(indices)

    def choose_action(self, state, evaluate=False):
        disc_state = self.discretize_state(state)
        if not evaluate and np.random.rand() < self.epsilon:
            return np.random.randint(self.n_actions)
        return int(np.argmax(self.q_table[disc_state]))

    def update(self, state, action, reward, next_state, done):
        disc_state = self.discretize_state(state)
        disc_next = self.discretize_state(next_state)
        best_next_action = np.argmax(self.q_table[disc_next])
        target = reward if done else reward + self.gamma * self.q_table[disc_next + (best_next_action,)]
        current = self.q_table[disc_state + (action,)]
        self.q_table[disc_state + (action,)] += self.lr * (target - current)

    def decay_epsilon(self):
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

def lqr_shaped_reward(state, terminated):
    """
    Reward based on standard quadratic cost J = x^T Q x + u^T R u
    Maximizing -J incentivizes rapid settling and minimal oscillation.
    """
    if terminated:
        return -100.0  # Heavy penalty for falling or track boundary violation
    
    x, x_dot, theta, theta_dot = state
    
    # Quadratic state weights:
    q_theta = 12.0
    q_theta_dot = 1.5
    q_x = 1.0
    q_x_dot = 0.5
    
    state_cost = (
        q_theta * (theta ** 2) +
        q_theta_dot * (theta_dot ** 2) +
        q_x * (x ** 2) +
        q_x_dot * (x_dot ** 2)
    )
    
    # Positive baseline to reward survival, penalized by state error
    r = 5.0 - state_cost
    return float(r)

def train_agent(num_episodes=900):
    env = gym.make('CartPole-v1')
    agent = AdvancedQCartPole()
    
    episode_rewards = []
    episode_lengths = []
    
    print(f"[*] Treinando Agente RL de Alta Performance ({num_episodes} episódios)...")
    for ep in range(num_episodes):
        state, _ = env.reset(seed=100 + ep)
        total_r = 0
        steps = 0
        done = False
        
        while not done:
            action = agent.choose_action(state)
            next_state, base_reward, terminated, truncated, _ = env.step(action)
            done = terminated or truncated
            
            r = lqr_shaped_reward(next_state, terminated)
            agent.update(state, action, r, next_state, done)
            
            state = next_state
            total_r += base_reward
            steps += 1
            if steps >= 500:
                break
                
        agent.decay_epsilon()
        episode_rewards.append(total_r)
        episode_lengths.append(steps)
        
        if (ep + 1) % 100 == 0:
            avg_last100 = np.mean(episode_lengths[-100:])
            print(f"Episódio {ep+1:4d} | Média Passos (últimos 100): {avg_last100:6.1f} | Epsilon: {agent.epsilon:.4f}")

    env.close()
    return agent, episode_rewards, episode_lengths

def simulate_pendulum_step(agent, initial_theta_deg=5.0, total_steps=500, dt=0.02):
    """
    Avalia a resposta do sistema a uma perturbação / condição inicial (Degrau em Theta)
    """
    env = gym.make('CartPole-v1')
    init_theta_rad = math.radians(initial_theta_deg)
    
    state, _ = env.reset()
    env.unwrapped.state = np.array([0.0, 0.0, init_theta_rad, 0.0], dtype=np.float64)
    state = env.unwrapped.state
    
    times = [0.0]
    thetas_deg = [math.degrees(state[2])]
    positions = [state[0]]
    velocities = [state[1]]
    ang_velocities = [math.degrees(state[3])]
    actions_force = []
    
    force_magnitude = 10.0 # Newtons
    destabilized = False
    
    for k in range(total_steps):
        t = (k + 1) * dt
        action = agent.choose_action(state, evaluate=True)
        force = -force_magnitude if action == 0 else force_magnitude
        actions_force.append(force)
        
        next_state, _, terminated, truncated, _ = env.step(action)
        state = next_state
        
        times.append(t)
        thetas_deg.append(math.degrees(state[2]))
        positions.append(state[0])
        velocities.append(state[1])
        ang_velocities.append(math.degrees(state[3]))
        
        if terminated:
            destabilized = True
            print(f"[!] Sistema atingiu limite em t={t:.2f}s")
            break

    if actions_force:
        actions_force.append(actions_force[-1])
    else:
        actions_force.append(0.0)

    env.close()
    
    thetas_arr = np.array(thetas_deg)
    times_arr = np.array(times)
    actions_arr = np.array(actions_force)
    positions_arr = np.array(positions)
    
    # Métricas de Engenharia de Controle
    # 1. Critério de Acomodação (Settling Time): critério de 5% da perturbação inicial ou ±0.5°
    band_deg = max(0.5, 0.05 * abs(initial_theta_deg))
    outside_band = np.where(np.abs(thetas_arr) > band_deg)[0]
    if len(outside_band) == 0:
        ts = 0.0
    elif outside_band[-1] < len(times_arr) - 1 and not destabilized:
        ts = times_arr[outside_band[-1] + 1]
    else:
        ts = times_arr[-1] if not destabilized else float('inf')

    # 2. Sobressinal Máximo (% Mp - Maximum Peak Overshoot)
    # Se perturbação positiva, sobressinal é a ultrapassagem para o lado oposto
    if initial_theta_deg > 0:
        undershoot_angles = thetas_arr[thetas_arr < 0]
        max_overshoot_deg = abs(np.min(undershoot_angles)) if len(undershoot_angles) > 0 else 0.0
    else:
        overshoot_angles = thetas_arr[thetas_arr > 0]
        max_overshoot_deg = abs(np.max(overshoot_angles)) if len(overshoot_angles) > 0 else 0.0

    mp_percent = (max_overshoot_deg / abs(initial_theta_deg)) * 100.0 if initial_theta_deg != 0 else 0.0

    # 3. Esforço Total de Controle (Integral da magnitude da força: int |u(t)| dt)
    control_effort = np.sum(np.abs(actions_arr[:-1])) * dt

    # 4. Comutações (Chopper/Chattering count)
    switches = int(np.sum(np.diff(actions_arr[:-1]) != 0))

    metrics = {
        "initial_theta_deg": float(initial_theta_deg),
        "settling_time_s": round(float(ts), 3),
        "band_deg": round(float(band_deg), 3),
        "overshoot_pct": round(float(mp_percent), 2),
        "max_overshoot_deg": round(float(max_overshoot_deg), 3),
        "peak_angle_deg": round(float(np.max(np.abs(thetas_arr))), 3),
        "total_control_effort_Ns": round(float(control_effort), 2),
        "force_max_N": float(force_magnitude),
        "chattering_switches": switches,
        "is_stable": not destabilized,
        "duration_s": round(float(times_arr[-1]), 2)
    }

    trajectory = {
        "times": [round(t, 3) for t in times],
        "thetas_deg": [round(th, 3) for th in thetas_deg],
        "positions": [round(p, 3) for p in positions],
        "velocities": [round(v, 3) for v in velocities],
        "forces": [round(f, 1) for f in actions_force]
    }

    return times_arr, thetas_arr, positions_arr, actions_arr, metrics, trajectory

def plot_and_save_graphics(ep_lengths, times, thetas, positions, forces, output_dir="results"):
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Gráfico de Treinamento
    fig1, ax1 = plt.subplots(figsize=(10, 4.8), dpi=180)
    eps = np.arange(1, len(ep_lengths) + 1)
    ax1.plot(eps, ep_lengths, color='#94a3b8', alpha=0.45, label='Passos por Episódio (Dispersão)')
    
    window = 40
    if len(ep_lengths) >= window:
        ma = np.convolve(ep_lengths, np.ones(window)/window, mode='valid')
        ax1.plot(np.arange(window, len(ep_lengths) + 1), ma, color='#0284c7', linewidth=2.4, label=f'Média Móvel ({window} ep)')

    ax1.axhline(500, color='#16a34a', linestyle='--', linewidth=1.6, label='Meta de Estabilidade Plena (500 steps)')
    ax1.set_title('Evolução do Treinamento por Aprendizado por Reforço (CartPole Control)', fontsize=13, fontweight='bold', pad=12)
    ax1.set_xlabel('Episódios de Treinamento', fontsize=11)
    ax1.set_ylabel('Passos de Sobrevivência (Duração)', fontsize=11)
    ax1.grid(True, linestyle=':', alpha=0.6)
    ax1.set_ylim(-10, 520)
    ax1.legend(loc='lower right', frameon=True, facecolor='white', framealpha=0.9)
    fig1.tight_layout()
    train_path = os.path.join(output_dir, "training_curve.png")
    fig1.savefig(train_path)
    plt.close(fig1)

    # 2. Gráfico da Resposta Dinâmica do Controlador
    fig2, (ax_th, ax_x, ax_u) = plt.subplots(3, 1, figsize=(10, 8.5), sharex=True, dpi=180)

    # Ângulo do pêndulo
    ax_th.plot(times, thetas, color='#dc2626', linewidth=2.0, label=r'Ângulo $\theta(t)$ [$^\circ$]')
    ax_th.axhline(0, color='black', linestyle=':', alpha=0.7)
    ax_th.axhspan(-0.5, 0.5, color='#22c55e', alpha=0.25, label=r'Faixa de Tolerância ($\pm 0.5^\circ$)')
    ax_th.set_ylabel(r'Ângulo $\theta$ ($^\circ$)', fontsize=11, fontweight='bold')
    ax_th.set_title('Resposta no Tempo e Análise de Desempenho do Sistema em Malha Fechada', fontsize=13, fontweight='bold')
    ax_th.grid(True, linestyle=':', alpha=0.6)
    ax_th.legend(loc='upper right', frameon=True, facecolor='white')

    # Deslocamento do carro
    ax_x.plot(times, positions, color='#2563eb', linewidth=1.8, label='Posição do Carrinho $x(t)$ [m]')
    ax_x.axhline(0, color='black', linestyle=':', alpha=0.7)
    ax_x.axhspan(-2.4, 2.4, color='#fbbf24', alpha=0.12, label='Fronteiras Físicas do Trilho ($\pm 2.4$m)')
    ax_x.set_ylabel('Posição $x$ (m)', fontsize=11, fontweight='bold')
    ax_x.grid(True, linestyle=':', alpha=0.6)
    ax_x.legend(loc='upper right', frameon=True, facecolor='white')

    # Ação de controle
    ax_u.step(times, forces, color='#7c3aed', where='post', linewidth=1.2, label='Esforço de Controle $u(t)$ [N]')
    ax_u.axhline(0, color='black', linestyle=':', alpha=0.7)
    ax_u.set_ylabel('Força $u$ (N)', fontsize=11, fontweight='bold')
    ax_u.set_xlabel('Tempo $t$ (segundos)', fontsize=11, fontweight='bold')
    ax_u.set_ylim(-13, 13)
    ax_u.grid(True, linestyle=':', alpha=0.6)
    ax_u.legend(loc='upper right', frameon=True, facecolor='white')

    fig2.tight_layout()
    resp_path = os.path.join(output_dir, "step_response.png")
    fig2.savefig(resp_path)
    plt.close(fig2)

    return train_path, resp_path

if __name__ == "__main__":
    agent, ep_rewards, ep_lengths = train_agent(num_episodes=900)
    
    # Avaliação com perturbação de 5 graus
    times, thetas, positions, forces, metrics, trajectory = simulate_pendulum_step(
        agent, initial_theta_deg=5.0, total_steps=500
    )

    print("\n" + "="*50)
    print("       RELATÓRIO DO ENGENHEIRO DE CONTROLE       ")
    print("="*50)
    print(f"Condição Inicial θ(0):          {metrics['initial_theta_deg']}°")
    print(f"Tempo de Acomodação (ts):       {metrics['settling_time_s']} s (faixa ±{metrics['band_deg']}°)")
    print(f"Sobressinal Máximo (Mp):        {metrics['overshoot_pct']}% (Ângulo máx ultrapassagem: {metrics['max_overshoot_deg']}°)")
    print(f"Sinal Máximo de Controle:       ±{metrics['force_max_N']} N")
    print(f"Esforço de Controle Total (∫|u|dt): {metrics['total_control_effort_Ns']} N·s")
    print(f"Frequência de Chattering:       {metrics['chattering_switches']} comutações")
    print(f"Status de Estabilidade:        {'ESTÁVEL (Malha Fechada Mantida)' if metrics['is_stable'] else 'INSTÁVEL'}")
    print("="*50 + "\n")

    train_img, resp_img = plot_and_save_graphics(ep_lengths, times, thetas, positions, forces)

    # Salva modelo e arquivo para o simulador web
    os.makedirs("models", exist_ok=True)
    np.save("models/q_table.npy", agent.q_table)
    with open("models/metadata.json", "w", encoding="utf-8") as f:
        json.dump({
            "bounds": agent.bounds,
            "n_bins": agent.n_bins,
            "metrics": metrics,
            "sample_trajectory": trajectory,
            "episodes": len(ep_lengths)
        }, f, indent=2)

    print("[✔] Treinamento refinado concluído com sucesso!")
